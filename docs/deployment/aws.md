# TelAgri Bank Dashboard - AWS Deployment Guide

## 🚀 AWS Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS CLOUD INFRASTRUCTURE                 │
├─────────────────────────────────────────────────────────────────┤
│  Frontend Distribution                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │   Route 53  │────│ CloudFront   │────│   S3 Bucket     │    │
│  │   (DNS)     │    │ (CDN + SSL)  │    │ (Static Assets) │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
│                             │                                   │
│  ┌─────────────────────────────────────────────────────────────┤
│  │                    EXTERNAL SERVICES                        │
│  │  ┌─────────────────┐    ┌─────────────────┐                │
│  │  │   Supabase      │    │   SendGrid      │                │
│  │  │ (Database,Auth, │    │ (Email Service) │                │
│  │  │  Storage, API)  │    │                 │                │
│  │  └─────────────────┘    └─────────────────┘                │
│  └─────────────────────────────────────────────────────────────┤
│                                                                 │
│  Monitoring & Security                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │ CloudWatch  │    │    WAF       │    │ Certificate     │    │
│  │ (Monitoring)│    │ (Security)   │    │ Manager (SSL)   │    │
│  └─────────────┘    └──────────────┘    └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Pre-Deployment Checklist

### ✅ **AWS Account Setup**
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Configure AWS credentials
aws configure
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: us-east-1
# Default output format: json
```

### ✅ **Domain & SSL Preparation**
```bash
# Register domain in Route 53 or update nameservers
# Request SSL certificate in ACM (us-east-1 for CloudFront)
# Validate domain ownership
```

### ✅ **Environment Variables**
```bash
# Production environment file (.env.production)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
VITE_APP_URL=https://dashboard.telagri.com
NODE_ENV=production
```

## 🏗️ Infrastructure as Code (AWS CDK)

### **CDK Stack Setup**
```typescript
// infrastructure/telagri-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class TelAgriDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for static website hosting
    const websiteBucket = new s3.Bucket(this, 'TelAgriDashboardBucket', {
      bucketName: 'telagri-dashboard-production',
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for non-prod
      autoDeleteObjects: true, // Only for non-prod
    });

    // SSL Certificate (must be in us-east-1 for CloudFront)
    const certificate = new acm.Certificate(this, 'TelAgriCertificate', {
      domainName: 'dashboard.telagri.com',
      subjectAlternativeNames: ['*.telagri.com'],
      validation: acm.CertificateValidation.fromDns(),
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'TelAgriDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      domainNames: ['dashboard.telagri.com'],
      certificate: certificate,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html', // SPA routing
        },
      ],
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin('your-project.supabase.co'),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
      },
    });

    // Route 53 DNS
    const hostedZone = route53.HostedZone.fromLookup(this, 'TelAgriZone', {
      domainName: 'telagri.com',
    });

    new route53.ARecord(this, 'TelAgriAliasRecord', {
      zone: hostedZone,
      recordName: 'dashboard',
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: websiteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'DomainName', {
      value: distribution.distributionDomainName,
    });
  }
}
```

### **Deploy Infrastructure**
```bash
# Install CDK
npm install -g aws-cdk

# Initialize CDK project
mkdir telagri-infrastructure && cd telagri-infrastructure
cdk init app --language typescript

# Install dependencies
npm install @aws-cdk/aws-s3 @aws-cdk/aws-cloudfront @aws-cdk/aws-route53

# Bootstrap CDK (one-time setup)
cdk bootstrap

# Deploy infrastructure
cdk deploy TelAgriDashboardStack
```

## 🔄 CI/CD Pipeline (GitHub Actions)

### **Workflow Configuration**
```yaml
# .github/workflows/deploy.yml
name: Deploy TelAgri Dashboard

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  AWS_REGION: 'us-east-1'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Build application
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_APP_URL: ${{ secrets.VITE_APP_URL }}

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security audit
        run: npm audit --audit-level moderate
      
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD

  deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build for production
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_APP_URL: ${{ secrets.VITE_APP_URL }}
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} --delete
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
      
      - name: Deploy Supabase functions
        run: |
          npx supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  lighthouse:
    needs: deploy
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            https://dashboard.telagri.com
            https://dashboard.telagri.com/auth
          configPath: './.lighthouserc.json'
          uploadArtifacts: true
```

### **Performance Budget**
```json
// .lighthouserc.json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["warn", {"minScore": 0.8}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["warn", {"minScore": 0.8}],
        "categories:seo": ["warn", {"minScore": 0.8}],
        "first-contentful-paint": ["warn", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["warn", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["warn", {"maxNumericValue": 0.1}]
      }
    }
  }
}
```

## 🔐 Security Configuration

### **S3 Bucket Policy**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::telagri-dashboard-production/*"
    },
    {
      "Sid": "DenyInsecureConnections",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::telagri-dashboard-production",
        "arn:aws:s3:::telagri-dashboard-production/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

### **CloudFront Security Headers**
```typescript
// Lambda@Edge function for security headers
exports.handler = (event, context, callback) => {
    const response = event.Records[0].cf.response;
    const headers = response.headers;
    
    headers['strict-transport-security'] = [{
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubdomains; preload'
    }];
    
    headers['content-security-policy'] = [{
        key: 'Content-Security-Policy',
        value: `
            default-src 'self';
            script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://js.sentry-cdn.com https://maps.googleapis.com https://maps.gstatic.com https://web-sdk.smartlook.com;
            style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
            font-src 'self' https://fonts.gstatic.com;
            img-src 'self' data: https: blob:;
            connect-src 'self' https://*.supabase.co https://*.telagri.com https://www.google-analytics.com https://sentry.io https://*.sentry.io wss://*.supabase.co https://maps.googleapis.com https://maps.gstatic.com https://*.smartlook.com;
            frame-src https://*.supabase.co https://view.officeapps.live.com https://*.google.com https://drive.google.com;
            object-src https://*.supabase.co blob: data:;
            base-uri 'self';
            form-action 'self';
            frame-ancestors 'none';
        `.replace(/\s+/g, ' ').trim()
    }];
    
    headers['x-content-type-options'] = [{
        key: 'X-Content-Type-Options',
        value: 'nosniff'
    }];
    
    headers['x-frame-options'] = [{
        key: 'X-Frame-Options',
        value: 'DENY'
    }];
    
    headers['x-xss-protection'] = [{
        key: 'X-XSS-Protection',
        value: '1; mode=block'
    }];
    
    headers['referrer-policy'] = [{
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
    }];
    
    callback(null, response);
};
```

### **WAF Configuration**
```typescript
// WAF rules for additional security
const webAcl = new wafv2.CfnWebACL(this, 'TelAgriWebACL', {
  name: 'TelAgriDashboardWAF',
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 1,
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
      name: 'RateLimitRule',
      priority: 2,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitMetric',
      },
    },
  ],
});
```

## 📊 Monitoring & Alerting

### **CloudWatch Dashboard**
```typescript
// CloudWatch dashboard for monitoring
const dashboard = new cloudwatch.Dashboard(this, 'TelAgriDashboard', {
  dashboardName: 'TelAgri-Dashboard-Production',
  widgets: [
    [
      new cloudwatch.GraphWidget({
        title: 'CloudFront Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: 'Requests',
            dimensionsMap: {
              DistributionId: distribution.distributionId,
            },
            statistic: 'Sum',
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'CloudFront Error Rate',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: '4xxErrorRate',
            dimensionsMap: {
              DistributionId: distribution.distributionId,
            },
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/CloudFront',
            metricName: '5xxErrorRate',
            dimensionsMap: {
              DistributionId: distribution.distributionId,
            },
          }),
        ],
      }),
    ],
  ],
});
```

### **Alarms Configuration**
```typescript
// Critical alarms
const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRate', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/CloudFront',
    metricName: '5xxErrorRate',
    dimensionsMap: {
      DistributionId: distribution.distributionId,
    },
  }),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: 'High 5xx error rate detected',
});

// SNS topic for alerts
const alertTopic = new sns.Topic(this, 'TelAgriAlerts', {
  displayName: 'TelAgri Dashboard Alerts',
});

// Subscribe email to alerts
new sns.Subscription(this, 'EmailAlerts', {
  topic: alertTopic,
  protocol: sns.SubscriptionProtocol.EMAIL,
  endpoint: 'alerts@telagri.com',
});

highErrorRateAlarm.addAlarmAction(new sns_actions.SnsAction(alertTopic));
```

## 🚀 Deployment Commands

### **One-Time Setup**
```bash
# 1. Deploy infrastructure
cd infrastructure/
cdk deploy TelAgriDashboardStack

# 2. Configure GitHub secrets
# Add these to GitHub repository secrets:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY  
# - S3_BUCKET_NAME
# - CLOUDFRONT_DISTRIBUTION_ID
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - VITE_APP_URL
# - SUPABASE_ACCESS_TOKEN
# - SUPABASE_PROJECT_REF

# 3. Deploy Supabase migrations
supabase db push --project-ref your-project-ref

# 4. Deploy Edge Functions
supabase functions deploy --project-ref your-project-ref
```

### **Manual Deployment (if needed)**
```bash
# Build application
npm run build

# Sync to S3
aws s3 sync dist/ s3://telagri-dashboard-production --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890123 \
  --paths "/*"

# Check deployment status
aws cloudfront get-invalidation \
  --distribution-id E1234567890123 \
  --id I1234567890123
```

## 🔧 Maintenance & Troubleshooting

### **Health Checks**
```bash
# Check application health
curl -I https://dashboard.telagri.com
curl -I https://dashboard.telagri.com/auth

# Check CloudFront status
aws cloudfront get-distribution --id E1234567890123

# Check S3 bucket policy
aws s3api get-bucket-policy --bucket telagri-dashboard-production
```

### **Log Analysis**
```bash
# CloudFront logs
aws logs describe-log-groups --log-group-name-prefix "/aws/cloudfront"

# Performance monitoring
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=E1234567890123 \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### **Rollback Procedure**
```bash
# Get previous deployment
aws s3 ls s3://telagri-dashboard-backups/

# Restore from backup
aws s3 sync s3://telagri-dashboard-backups/2024-01-01/ s3://telagri-dashboard-production/

# Invalidate cache
aws cloudfront create-invalidation --distribution-id E1234567890123 --paths "/*"
```

## 📋 Production Checklist

### **Before Go-Live**
- [ ] SSL certificate validated and deployed
- [ ] Domain DNS properly configured
- [ ] Security headers implemented
- [ ] WAF rules configured and tested
- [ ] Monitoring and alerting set up
- [ ] Backup procedures established
- [ ] Performance testing completed
- [ ] Security scanning passed
- [ ] Load testing performed
- [ ] Disaster recovery plan documented

### **Post-Deployment**
- [ ] Verify all application functionality
- [ ] Test 2FA email delivery
- [ ] Validate user invitation flow
- [ ] Check mobile responsiveness
- [ ] Monitor error rates for 24 hours
- [ ] Validate backup procedures
- [ ] Test rollback procedures
- [ ] Update documentation
- [ ] Train support team
- [ ] Schedule security review

---

## 🎯 **Success Metrics**

**Performance Targets:**
- Page load time < 2 seconds
- Time to first contentful paint < 1.5 seconds
- Largest contentful paint < 2.5 seconds
- Cumulative layout shift < 0.1

**Availability Targets:**
- 99.9% uptime
- < 0.1% error rate
- Recovery time < 5 minutes

**Security Targets:**
- Zero security vulnerabilities
- 100% HTTPS traffic
- WAF blocking rate > 99%
- Zero data breaches

This deployment architecture ensures your TelAgri bank dashboard is production-ready with enterprise-grade security, performance, and reliability! 🚀 