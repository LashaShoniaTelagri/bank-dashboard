# GitHub Actions OIDC Setup

## Overview

The GitHub Actions workflow requires an OIDC role to authenticate with AWS. This role is managed manually to avoid CDK conflicts.

## Initial Setup

When setting up a new environment or if the GitHub Actions role doesn't exist:

```bash
# Run the OIDC role creation script
./scripts/create-github-oidc-role.sh
```

This script will:
- Create the GitHub OIDC Identity Provider (if needed)
- Create the `GithubActionsRole` with proper trust policies
- Attach necessary AWS managed policies
- Add inline policies for Parameter Store and KMS access

## Role Configuration

The role is configured with:

### Trust Policy
- **Principal**: `token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`
- **Repository**: `LashaShoniaTelagri/bank-dashboard:*`

### Attached Policies
- `AWSCloudFormationFullAccess`
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`
- `IAMFullAccess`
- `AWSKeyManagementServicePowerUser`

### Inline Policies
- **ParameterStoreAccess**: Access to `/telagri/monitoring/*` parameters
- **KMSAccess**: Decrypt/encrypt operations for Parameter Store
- **WAFAccess**: Web Application Firewall management

## Why Manual Management?

The GitHub Actions role is managed manually (not via CDK) because:

1. **Chicken-and-egg problem**: CDK needs the role to run, but CDK creates the role
2. **Deployment reliability**: Manual role ensures GitHub Actions always works
3. **Conflict avoidance**: Prevents CDK from trying to manage existing resources

## Troubleshooting

### Role Already Exists Error
If you see `The policy ParameterStoreAccess already exists on the role GithubActionsRole`:

1. The role was created manually but CDK is trying to manage it
2. This is expected - CDK should not manage this role
3. Ensure the CDK stack doesn't include GitHub Actions role creation

### Authentication Failures
If GitHub Actions can't authenticate:

1. Verify the role exists: `aws iam get-role --role-name GithubActionsRole`
2. Check the trust policy allows your repository
3. Verify the OIDC provider exists
4. Re-run the setup script if needed

## Security Considerations

- Role is scoped to specific GitHub repository
- Uses OIDC for secure, token-based authentication
- No long-lived credentials stored in GitHub secrets
- Policies follow least-privilege principle for deployment needs
