# GitHub Actions Setup for TelAgri Bank Dashboard

This guide explains how to configure GitHub repository variables and secrets for automated deployment of the TelAgri Bank Dashboard PWA to AWS.

## 🎯 Overview

The deployment uses GitHub Actions with:
- **Repository Variables**: Non-sensitive configuration
- **Environment Secrets**: Sensitive credentials  
- **OIDC Authentication**: Secure AWS access without long-term keys
- **Cross-Account Route 53**: Secure DNS management

---

## 🔐 AWS OIDC Setup (Recommended)

### 1. Create GitHub OIDC Provider in AWS

In your AWS deployment account, create an OIDC identity provider:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 2. Create GitHub Actions IAM Role

Create a role that GitHub Actions can assume:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::183784642322:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
                          "token.actions.githubusercontent.com:sub": "repo:LashaShoniaTelagri/bank-dashboard:*"
        }
      }
    }
  ]
}
```

### 3. Attach Deployment Permissions

Create and attach a policy to the GitHub Actions role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "cloudfront:*",
        "wafv2:*",
        "iam:*",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "route53:GetHostedZone",
        "route53:ListHostedZones",
        "sts:AssumeRole"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## ⚙️ GitHub Repository Configuration

### Repository Variables
Navigate to **Settings → Secrets and variables → Actions → Variables**

Add these repository variables:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `AWS_ACCOUNT_ID` | `183784642322` | Your AWS deployment account ID |
| `AWS_REGION` | `us-east-1` | AWS region (use us-east-1 for CloudFront) |
| `AWS_ROLE_ARN` | `arn:aws:iam::183784642322:role/GitHubActionsRole` | OIDC role for GitHub Actions |
| `CERTIFICATE_ARN` | `arn:aws:acm:us-east-1:183784642322:certificate/01bf431a-ee0c-4003-bfa4-717daf70fa3b` | ACM SSL certificate ARN |

**Note**: We simplified the setup by removing Route53 automation. DNS will be managed manually.

### Environment-Specific Variables (Optional)
Create environments: `dev`, `staging`, `prod`

**For each environment, add:**

| Variable | Dev Value | Staging Value | Prod Value |
|----------|-----------|---------------|------------|
| `DOMAIN_NAME` | `bank-dev.telagri.com` | `bank-staging.telagri.com` | `bank.telagri.com` |

---

## 🔗 Finding AWS Resource ARNs

### 1. SSL Certificate ARN
```bash
# List certificates in us-east-1 (required for CloudFront)
aws acm list-certificates --region us-east-1

# Get specific certificate details
aws acm describe-certificate --certificate-arn "arn:aws:acm:..." --region us-east-1
```

### 2. Route 53 Hosted Zone ID
```bash
# List all hosted zones
aws route53 list-hosted-zones

# Get specific zone details
aws route53 get-hosted-zone --id Z1D633PJN98FT9
```

### 3. Cross-Account Role ARN
In your root account (where Route 53 is hosted):
```bash
# List IAM roles
aws iam list-roles | grep -A 5 -B 5 "TelAgriRoute53"

# Get role details
aws iam get-role --role-name TelAgriRoute53CrossAccountRole
```

---

## 🚀 Deployment Triggers

### Automatic Deployment
- **Push to `main`** → Production deployment
- **Push to `staging`** → Staging deployment  
- **Push to `develop`** → Development deployment
- **Pull Request to `main`** → Build validation only

### Manual Deployment
1. Go to **Actions** tab in GitHub
2. Select **"🌾 Deploy TelAgri Bank Dashboard"**
3. Click **"Run workflow"**
4. Choose environment: `dev`, `staging`, or `prod`
5. Click **"Run workflow"**

---

## 🔐 Cross-Account Route 53 Setup

### Root Account Setup (Where Route 53 is hosted)

#### 1. Create Cross-Account Role
```bash
# Create role with trust policy
aws iam create-role \
  --role-name TelAgriRoute53CrossAccountRole \
  --assume-role-policy-document file://trust-policy.json
```

**trust-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::DEPLOYMENT_ACCOUNT_ID:root"
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

#### 2. Create Route 53 Policy
```bash
# Create policy for Route 53 access
aws iam create-policy \
  --policy-name TelAgriRoute53Policy \
  --policy-document file://route53-policy.json
```

**route53-policy.json:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:GetHostedZone",
        "route53:ListResourceRecordSets",
        "route53:GetChange"
      ],
      "Resource": [
        "arn:aws:route53:::hostedzone/YOUR_HOSTED_ZONE_ID",
        "arn:aws:route53:::change/*"
      ]
    }
  ]
}
```

#### 3. Attach Policy to Role
```bash
aws iam attach-role-policy \
  --role-name TelAgriRoute53CrossAccountRole \
  --policy-arn arn:aws:iam::ROOT_ACCOUNT_ID:policy/TelAgriRoute53Policy
```

---

## 🧪 Testing the Setup

### 1. Test GitHub Actions Role
```bash
# Configure AWS CLI with GitHub Actions role
aws sts assume-role \
  --role-arn "arn:aws:iam::YOUR_ACCOUNT:role/GitHubActionsRole" \
  --role-session-name "test-session"
```

### 2. Test Cross-Account Role
```bash
# Test assuming cross-account role
aws sts assume-role \
  --role-arn "arn:aws:iam::ROOT_ACCOUNT:role/TelAgriRoute53CrossAccountRole" \
  --role-session-name "test-route53"
```

### 3. Test Route 53 Access
```bash
# Test listing hosted zones
aws route53 list-hosted-zones

# Test specific zone access
aws route53 get-hosted-zone --id YOUR_HOSTED_ZONE_ID
```

---

## 📊 Monitoring Deployments

### GitHub Actions Logs
- Monitor deployment progress in **Actions** tab
- Check individual job logs for detailed information
- Review security scan results

### AWS Console Monitoring
- **CloudFormation**: Stack deployment status
- **CloudFront**: Distribution creation and configuration
- **S3**: File uploads and bucket policies
- **WAF**: Security rule deployment
- **Route 53**: DNS record creation

### Deployment Outputs
After successful deployment, check these outputs:
```bash
# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name TelAgri-Bank-Dashboard-prod \
  --query 'Stacks[0].Outputs' \
  --output table
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. OIDC Authentication Failures
```
Error: Could not assume role with OIDC
```
**Solution**: Verify GitHub repository matches the OIDC condition exactly

#### 2. Cross-Account Role Access Denied
```
Error: User: arn:aws:sts::123:assumed-role/GitHubActionsRole is not authorized to perform: sts:AssumeRole
```
**Solution**: Check cross-account role trust policy and permissions

#### 3. Certificate Not Found
```
Error: Certificate arn:aws:acm:... not found
```
**Solution**: Ensure certificate exists in `us-east-1` region

#### 4. Route 53 Permission Denied
```
Error: User is not authorized to perform: route53:ChangeResourceRecordSets
```
**Solution**: Verify hosted zone ID and cross-account role permissions

### Debug Steps
1. **Check AWS CLI configuration**:
   ```bash
   aws sts get-caller-identity
   ```

2. **Validate role assumptions**:
   ```bash
   aws sts assume-role --role-arn YOUR_ROLE_ARN --role-session-name debug
   ```

3. **Test CDK synthesis locally**:
   ```bash
   cd cdk && npm run synth
   ```

4. **Review GitHub Actions logs** for detailed error messages

---

## 🔄 Updates and Maintenance

### Regular Tasks
- **Monthly**: Update GitHub Actions to latest versions
- **Quarterly**: Review and rotate AWS access keys (if using)
- **Annually**: Audit IAM permissions and policies

### Security Best Practices
- ✅ Use OIDC instead of long-term access keys
- ✅ Implement least-privilege IAM policies
- ✅ Enable AWS CloudTrail for audit logging
- ✅ Monitor GitHub Actions usage and costs
- ✅ Regularly review repository access and secrets

---

## 📋 Checklist for Setup

### Prerequisites
- [ ] AWS deployment account with CDK bootstrap
- [ ] Root account with Route 53 hosted zone
- [ ] SSL certificate in ACM (us-east-1)
- [ ] GitHub repository with admin access

### AWS Configuration
- [ ] Create GitHub OIDC identity provider
- [ ] Create GitHub Actions IAM role
- [ ] Attach deployment permissions policy
- [ ] Create cross-account Route 53 role (in root account)
- [ ] Test role assumptions

### GitHub Configuration
- [ ] Add all repository variables
- [ ] Set up environment-specific variables
- [ ] Test manual workflow trigger
- [ ] Verify automatic deployment triggers

### Testing
- [ ] Run manual deployment to dev environment
- [ ] Verify DNS resolution
- [ ] Check SSL certificate and security headers
- [ ] Test PWA installation
- [ ] Validate WAF protection

---

**🎉 Once configured, your TelAgri Bank Dashboard will deploy automatically with enterprise-grade security and performance! 🌾** 