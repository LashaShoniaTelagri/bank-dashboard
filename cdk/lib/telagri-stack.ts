import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
// import * as route53 from 'aws-cdk-lib/aws-route53';
// import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface TelAgriStackProps extends cdk.StackProps {
  domainName: string;
  hostedZoneId: string;
  certificateArn: string;
  crossAccountRoleArn: string;
  rootAccountId: string;
  environment: 'dev' | 'staging' | 'prod';
}

export class TelAgriStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: TelAgriStackProps) {
    super(scope, id, props);

    const { domainName, hostedZoneId, certificateArn, crossAccountRoleArn, rootAccountId, environment } = props;

    // S3 Bucket for Static Website Hosting
    this.bucket = new s3.Bucket(this, 'TelAgriBankDashboardBucket', {
      bucketName: `telagri-bank-dashboard-${environment}-${this.account}`,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });



    // WAF Web ACL for Security
    const webAcl = new wafv2.CfnWebACL(this, 'TelAgriWebACL', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      description: `TelAgri Bank Dashboard WAF - ${environment}`,
      name: `TelAgri-Bank-Dashboard-WAF-${environment}`,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `TelAgri-WAF-${environment}`,
      },
      rules: [
        // Rate limiting rule
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        // AWS Managed Rules - Core Rule Set
        {
          name: 'AWSManagedRulesCoreRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSetMetric',
          },
        },
      ],
    });

    // Import existing certificate
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'TelAgriCertificate',
      certificateArn
    );

    // Response Headers Policy for Security
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `TelAgri-Security-Headers-${environment}`,
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.supabase.co https://cdn.telagri.com; style-src 'self' 'unsafe-inline' https://cdn.telagri.com; img-src 'self' data: https: https://cdn.telagri.com; font-src 'self' data: https://cdn.telagri.com; connect-src 'self' *.supabase.co wss://*.supabase.co https://cdn.telagri.com; worker-src 'self' blob:; manifest-src 'self';",
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.SAMEORIGIN, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
            override: true,
          },
          {
            header: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
            override: true,
          },
        ],
      },
    });

    // Cache Policy for PWA
    const cachePolicy = new cloudfront.CachePolicy(this, 'PWACachePolicy', {
      cachePolicyName: `TelAgri-PWA-Cache-${environment}`,
      defaultTtl: cdk.Duration.days(1),
      maxTtl: cdk.Duration.days(365),
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization', 'CloudFront-Viewer-Country'),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Origin Request Policy
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'PWAOriginRequestPolicy', {
      originRequestPolicyName: `TelAgri-PWA-Origin-${environment}`,
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'CloudFront-Viewer-Country',
        'CloudFront-Is-Mobile-Viewer',
        'CloudFront-Is-Tablet-Viewer'
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.none(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'TelAgriDistribution', {
      domainNames: [domainName],
      certificate: certificate,
      defaultRootObject: 'index.html',
      webAclId: webAcl.attrArn,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cachePolicy,
        originRequestPolicy: originRequestPolicy,
        responseHeadersPolicy: responseHeadersPolicy,
        compress: true,
      },
      additionalBehaviors: {
        // Service Worker - always fresh
        '/sw.js': {
          origin: new origins.S3Origin(this.bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          responseHeadersPolicy: responseHeadersPolicy,
        },
        // Manifest - cache but validate
        '/manifest.webmanifest': {
          origin: new origins.S3Origin(this.bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'ManifestCachePolicy', {
            defaultTtl: cdk.Duration.hours(1),
            maxTtl: cdk.Duration.days(1),
          }),
          responseHeadersPolicy: responseHeadersPolicy,
        },
        // API routes (if any)
        '/api/*': {
          origin: new origins.S3Origin(this.bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          responseHeadersPolicy: responseHeadersPolicy,
        },
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      comment: `TelAgri Bank Dashboard - ${environment}`,
    });

    // Grant CloudFront access to S3 bucket
    this.bucket.grantRead(new iam.ServicePrincipal('cloudfront.amazonaws.com'));

    // Route53 configuration commented out for testing
    // Will be added back when real DNS values are configured
    
    /*
    // Cross-Account Role for Route 53 DNS Management
    const crossAccountRole = iam.Role.fromRoleArn(
      this,
      'CrossAccountRoute53Role',
      crossAccountRoleArn
    );

    // Import hosted zone from root account
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'TelAgriHostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: domainName.split('.').slice(-2).join('.'), // Extract root domain
    });

    // Route 53 A Record pointing to CloudFront
    new route53.ARecord(this, 'TelAgriAliasRecord', {
      zone: hostedZone,
      recordName: domainName.split('.')[0], // subdomain only
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
      ttl: cdk.Duration.minutes(5),
      comment: `TelAgri Bank Dashboard ${environment} - Managed by CDK`,
    });
    */

    // S3 Deployment
    new s3deploy.BucketDeployment(this, 'TelAgriDeployment', {
      sources: [s3deploy.Source.asset('../dist')],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true,
      retainOnDelete: environment === 'prod',
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket Name',
      exportName: `TelAgri-${environment}-BucketName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `TelAgri-${environment}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `TelAgri-${environment}-DistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${domainName}`,
      description: 'TelAgri Bank Dashboard URL (Custom Domain)',
      exportName: `TelAgri-${environment}-WebsiteURL`,
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL (for DNS setup)',
      exportName: `TelAgri-${environment}-CloudFrontURL`,
    });

    new cdk.CfnOutput(this, 'WebACLId', {
      value: webAcl.attrId,
      description: 'WAF Web ACL ID',
      exportName: `TelAgri-${environment}-WebACLId`,
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'TelAgri-Bank-Dashboard');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Owner', 'TelAgri-Tech-Team');
    cdk.Tags.of(this).add('CostCenter', 'AgriTech');
    cdk.Tags.of(this).add('ManagedBy', 'AWS-CDK');
  }
} 