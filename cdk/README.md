# TelAgri Bank Dashboard - AWS CDK Infrastructure

This directory contains the AWS CDK infrastructure code for deploying the TelAgri Bank Dashboard PWA to AWS with production-grade security, performance, and scalability.

## 🌾 Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   CloudFront    │    │     WAF      │    │   Route 53      │
│   Distribution  │◄──►│   Web ACL    │    │  (Root Account) │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                                           │
         ▼                                           ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   S3 Bucket     │    │ SSL/TLS Cert │    │ Cross-Account   │
│  (Static Site)  │    │   (ACM)      │    │   IAM Role     │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## 🏗️ Infrastructure Components

### Core Services
- **S3 Bucket**: Static website hosting with versioning
- **CloudFront**: Global CDN with HTTP/2 + HTTP/3 support
- **WAF**: Web Application Firewall with rate limiting
- **Route 53**: DNS management (cross-account)
- **ACM**: SSL/TLS certificate (existing)

### Security Features
- **Origin Access Control (OAC)**: Secure S3 access
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **Rate Limiting**: 2000 requests per 5 minutes per IP
- **Managed Rules**: AWS Core Rule Set + Known Bad Inputs
- **Cross-Account Role**: Secure Route 53 management

### PWA Optimization
- **Service Worker Caching**: No-cache for `/sw.js`
- **Manifest Caching**: 1-hour TTL for `/manifest.webmanifest`
- **Asset Caching**: 365-day max TTL for static assets
- **Error Handling**: SPA routing with 404 → index.html

## ⚙️ Prerequisites

### AWS Account Setup
1. **Primary Account**: Where the CDK stack will be deployed
2. **Root Account**: Where Route 53 hosted zone exists
3. **Cross-Account Role**: IAM role for Route 53 access
4. **SSL Certificate**: ACM certificate in us-east-1

### Required Tools
```bash
# Node.js 18+
node --version

# AWS CLI v2
aws --version

# AWS CDK v2
npm install -g aws-cdk
cdk --version
```

## 🚀 Deployment

### 1. Environment Variables
Set these in your GitHub repository or local environment:

```bash
# Required Variables
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"
export DOMAIN_NAME="bank.telagri.com"
export HOSTED_ZONE_ID="Z1D633PJN98FT9"
export CERTIFICATE_ARN="arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012"
export CROSS_ACCOUNT_ROLE_ARN="arn:aws:iam::987654321098:role/TelAgriRoute53CrossAccountRole"
export ROOT_ACCOUNT_ID="987654321098"
export ENVIRONMENT="prod"
```

### 2. Install Dependencies
```bash
cd cdk
npm install
```

### 3. Build CDK
```bash
npm run build
```

### 4. Bootstrap CDK (First Time Only)
```bash
cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}
```

### 5. Deploy Stack
```bash
# Review changes
npm run diff

# Deploy infrastructure
npm run deploy

# Or deploy with confirmation
cdk deploy --require-approval never
```

## 🔧 Configuration

### Environment-Specific Domains
- **Production**: `bank.telagri.com`
- **Staging**: `bank-staging.telagri.com`
- **Development**: `bank-dev.telagri.com`

### WAF Rules
1. **Rate Limiting**: 2000 req/5min per IP
2. **Core Rule Set**: OWASP protections
3. **Known Bad Inputs**: Malicious patterns

### Cache Policies
- **Default**: 1 day TTL, up to 365 days max
- **Service Worker**: No cache (always fresh)
- **Manifest**: 1 hour cache with validation
- **API Routes**: No cache (if applicable)

## 🔐 Cross-Account Route 53 Setup

### 1. Root Account (Route 53 Owner)
Create a cross-account role with Route 53 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::DEPLOYMENT_ACCOUNT:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "TelAgri-Route53-Access"
        }
      }
    }
  ]
}
```

**Policy for the role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/Z1D633PJN98FT9"
    }
  ]
}
```

### 2. Deployment Account
Ensure your deployment role can assume the cross-account role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::ROOT_ACCOUNT:role/TelAgriRoute53CrossAccountRole"
    }
  ]
}
```

## 📊 Monitoring & Outputs

### Stack Outputs
After deployment, the stack provides:
- **S3 Bucket Name**: For manual uploads if needed
- **CloudFront Distribution ID**: For invalidations
- **Website URL**: The final accessible URL
- **WAF Web ACL ID**: For additional rule management

### CloudWatch Metrics
- **CloudFront**: Request count, error rates, cache hit ratio
- **WAF**: Blocked requests, rate limit triggers
- **S3**: Bucket metrics and access patterns

## 🔧 Local Development

### Test CDK Synthesis
```bash
npm run synth
```

### Watch for Changes
```bash
npm run watch
```

### Run Tests
```bash
npm test
```

## 🗑️ Cleanup

### Destroy Stack
```bash
# Non-production environments
cdk destroy

# Production (manual confirmation required)
cdk destroy --force
```

**Note**: Production S3 buckets have `RETAIN` policy and require manual deletion.

## 🚨 Troubleshooting

### Common Issues

1. **Certificate not found**: Ensure certificate exists in `us-east-1`
2. **Route 53 access denied**: Verify cross-account role setup
3. **S3 deployment fails**: Check CloudFront invalidation permissions
4. **WAF blocks requests**: Review rate limiting rules

### Debug Commands
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name TelAgri-Bank-Dashboard-prod

# View CloudFront distribution
aws cloudfront get-distribution --id E1234567890123

# Test Route 53 resolution
nslookup bank.telagri.com

# Check WAF logs
aws wafv2 get-web-acl --scope CLOUDFRONT --id <web-acl-id>
```

## 📋 Maintenance

### Regular Tasks
- **Update dependencies**: Monthly CDK and AWS CLI updates
- **Review WAF logs**: Weekly security assessment
- **Monitor costs**: Monthly AWS cost analysis
- **Certificate renewal**: Automatic with ACM
- **Cache invalidations**: After significant updates

### Security Updates
- **WAF rules**: Quarterly review and updates
- **IAM permissions**: Annual least-privilege audit
- **SSL/TLS settings**: Annual security standard compliance

---

## 🌾 Support

For infrastructure issues or questions:
- **CDK Issues**: Check AWS CDK documentation
- **AWS Service Limits**: Review account quotas
- **Cross-Account Access**: Verify IAM role trust policies
- **DNS Resolution**: Check Route 53 hosted zone settings

**Your TelAgri infrastructure is production-ready with enterprise-grade security! 🚀** 