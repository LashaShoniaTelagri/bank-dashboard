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
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as kms from 'aws-cdk-lib/aws-kms';
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
      rules: [
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
        {
          name: 'AWSManagedRulesCommonRuleSet',
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
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'TelAgriWebACL',
      },
    });

    // Custom Response Headers Policy with unique naming
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp for uniqueness
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'TelAgriResponseHeadersPolicy', {
      responseHeadersPolicyName: `TelAgri-Monitoring-Headers-${environment}-${timestamp}`,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true },
        strictTransportSecurity: { accessControlMaxAge: cdk.Duration.seconds(31536000), includeSubdomains: true, override: true },
        contentSecurityPolicy: { 
          contentSecurityPolicy: [
            "default-src 'self'",
            // Allow Google Maps scripts
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.sentry-cdn.com https://maps.googleapis.com https://maps.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.supabase.co https://*.telagri.com https://www.google-analytics.com https://sentry.io https://*.sentry.io wss://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com",
            // Allow iframes for Office viewer, Supabase signed URLs, and Google Docs/Drive viewers
            "frame-src https://*.supabase.co https://view.officeapps.live.com https://*.google.com https://drive.google.com",
            // Allow PDF object embedding from Supabase (FileViewer primary renderer) and data/blob URLs
            "object-src https://*.supabase.co blob: data:",
            "base-uri 'self'",
            "form-action 'self'"
          ].join('; '),
          override: true 
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'X-Robots-Tag',
            value: environment === 'prod' ? 'index, follow' : 'noindex, nofollow',
            override: true,
          },
          {
            header: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
            override: false,
          },
        ],
      },
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'TelAgriDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'TelAgriCachePolicy', {
          defaultTtl: cdk.Duration.days(1),
          maxTtl: cdk.Duration.days(365),
          minTtl: cdk.Duration.seconds(0),
          cachePolicyName: `TelAgri-Monitoring-Cache-${environment}-${timestamp}`,
        }),
        responseHeadersPolicy: responseHeadersPolicy,
        compress: true,
      },
      domainNames: [domainName],
      certificate: acm.Certificate.fromCertificateArn(this, 'TelAgriCertificate', certificateArn),
      webAclId: webAcl.attrArn,
      defaultRootObject: 'index.html',
      additionalBehaviors: {
        // Service Worker - no cache
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
            cachePolicyName: `TelAgri-Monitoring-Manifest-${environment}-${timestamp}`,
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
      comment: `TelAgri Monitoring - ${environment}`,
    });

    // Grant CloudFront access to S3 bucket
    this.bucket.grantRead(new iam.ServicePrincipal('cloudfront.amazonaws.com'));

    // S3 Bucket Deployment
    new s3deploy.BucketDeployment(this, 'TelAgriDeployment', {
      sources: [s3deploy.Source.asset('../dist')],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      prune: true,
      retainOnDelete: environment === 'prod',
    });

    // KMS Key for Parameter Store encryption
    const parameterStoreKmsKey = new kms.Key(this, 'ParameterStoreKMSKey', {
      description: `TelAgri Monitoring Parameter Store encryption key - ${environment}`,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow GitHub Actions Role',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/GithubActionsRole`)],
            actions: [
              'kms:Decrypt',
              'kms:DescribeKey',
              'kms:GenerateDataKey',
            ],
            resources: ['*'],
          }),
        ],
      }),
    });

    // KMS Key Alias
    new kms.Alias(this, 'ParameterStoreKMSKeyAlias', {
      aliasName: `alias/telagri-monitoring-${environment}`,
      targetKey: parameterStoreKmsKey,
    });

    // Frontend Environment Parameter (with placeholder values)
    const frontendParameter = new ssm.StringParameter(this, 'FrontendEnvironmentParameter', {
      parameterName: `/telagri/monitoring/${environment}/frontend/env`,
      description: `Frontend environment configuration for ${environment}`,
      stringValue: this.getFrontendEnvironmentTemplate(environment),
    });

    // Backend Environment Parameter (with placeholder values)
    const backendParameter = new ssm.StringParameter(this, 'BackendEnvironmentParameter', {
      parameterName: `/telagri/monitoring/${environment}/backend/env`,
      description: `Backend environment configuration for ${environment}`,
      stringValue: this.getBackendEnvironmentTemplate(environment),
    });

    // Note: GitHub Actions IAM Role is managed manually via scripts/create-github-oidc-role.sh
    // This avoids CDK conflicts when the role already exists from manual creation

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'WebACLArn', {
      value: webAcl.attrArn,
      description: 'WAF Web ACL ARN',
    });

    new cdk.CfnOutput(this, 'FrontendParameterName', {
      value: frontendParameter.parameterName,
      description: 'Frontend Environment Parameter Name',
    });

    new cdk.CfnOutput(this, 'BackendParameterName', {
      value: backendParameter.parameterName,
      description: 'Backend Environment Parameter Name',
    });

    // Tags
    cdk.Tags.of(this).add('Project', 'TelAgri-Monitoring');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Owner', 'TelAgri-Tech-Team');
    cdk.Tags.of(this).add('CostCenter', 'AgriTech');
    cdk.Tags.of(this).add('ManagedBy', 'AWS-CDK');
  }

  /**
   * Generate frontend environment template with secure placeholders
   */
  private getFrontendEnvironmentTemplate(environment: string): string {
    const baseUrl = environment === 'prod' 
      ? 'https://dashboard.telagri.com' 
      : `https://dashboard-${environment}.telagri.com`;

    // Secure project IDs (these are not sensitive)
    const supabaseProjectId = environment === 'prod' 
      ? 'imncjxfppzikerifyukk'  // PROD project ID
      : 'jhelkawgkjohvzsusrnw';  // DEV project ID

    return `# Application Configuration
VITE_APP_NAME=TelAgri Monitoring
VITE_APP_VERSION=2.0.0
VITE_APP_ENVIRONMENT=${environment}

# Supabase Configuration (Public keys only - replace with real values)
VITE_SUPABASE_URL=https://${supabaseProjectId}.supabase.co
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_${environment.toUpperCase()}_ANON_KEY

# Public Service URLs
VITE_APP_URL=${baseUrl}

# Public API Keys (with domain restrictions - replace with real values)
VITE_APP_GOOGLE_MAPS_API_KEY=REPLACE_WITH_GOOGLE_MAPS_API_KEY

# Analytics & Monitoring (Public keys - replace with real values)
VITE_APP_TAG_MANAGER_KEY=REPLACE_WITH_TAG_MANAGER_KEY
VITE_APP_SENTRY_DSN=REPLACE_WITH_SENTRY_DSN
VITE_APP_CDN_URL=https://cdn.telagri.com/
VITE_APP_HYPERDX_API_KEY=REPLACE_WITH_HYPERDX_API_KEY
VITE_APP_HYPERDX_ENABLED=${environment === 'prod' ? 'true' : 'false'}`;
  }

  /**
   * Generate backend environment template with secure placeholders
   */
  private getBackendEnvironmentTemplate(environment: string): string {
    const baseUrl = environment === 'prod' 
      ? 'https://dashboard.telagri.com' 
      : `https://dashboard-${environment}.telagri.com`;

    // Secure project IDs (these are not sensitive)
    const supabaseProjectId = environment === 'prod' 
      ? 'imncjxfppzikerifyukk'  // PROD project ID
      : 'jhelkawgkjohvzsusrnw';  // DEV project ID

    return `# Backend Environment Configuration (Server-side only)

# Email Service (SENSITIVE - replace with real values)
SENDGRID_API_KEY=REPLACE_WITH_SENDGRID_API_KEY
SENDGRID_FROM_EMAIL=noreply@telagri.com

# Server Configuration
SITE_URL=${baseUrl}
VITE_APP_URL=${baseUrl}

# Supabase ${environment.charAt(0).toUpperCase() + environment.slice(1)} Configuration
VITE_SUPABASE_URL=https://${supabaseProjectId}.supabase.co
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_${environment.toUpperCase()}_ANON_KEY

# ${environment.charAt(0).toUpperCase() + environment.slice(1)} Database Connection (for migrations)
SUPABASE_PROJECT_ID=${supabaseProjectId}
SUPABASE_DB_PASSWORD=REPLACE_WITH_${environment.toUpperCase()}_DB_PASSWORD

# Edge Functions Environment (renamed to avoid Supabase restrictions)
PROJECT_URL=https://${supabaseProjectId}.supabase.co
SERVICE_ROLE_KEY=REPLACE_WITH_${environment.toUpperCase()}_SERVICE_ROLE_KEY`;
  }
}
