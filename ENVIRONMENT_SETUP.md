# Environment Configuration Setup

This document explains how to set up environment-specific configurations for the TelAgri Bank Dashboard using AWS Systems Manager Parameter Store.

## 🏗️ Architecture

The application uses environment-specific `.env` files that are:
- **Generated at build time** from AWS Systems Manager Parameter Store
- **Environment-specific** (dev, staging, prod)
- **Secure** (encrypted with KMS, never committed to repository)
- **Centrally managed** (AWS Parameter Store with proper IAM controls)

## 📁 File Structure

```
├── env.template          # Template for all environments
├── env.dev              # Development configuration (gitignored)
├── env.staging          # Staging configuration (gitignored)  
├── env.prod             # Production configuration (gitignored)
└── scripts/
    └── generate-env-base64.sh  # Helper script to generate base64 strings
```

## 🔧 Setup Instructions

### 1. Create Environment Files

For each environment, create the configuration file:

```bash
# Copy template for each environment
cp env.template env.dev
cp env.template env.staging
cp env.template env.prod
```

### 2. Configure Environment Values

Edit each environment file with appropriate values:

#### `env.dev` (Development)
```bash
VITE_SUPABASE_URL=https://jhelkawgkjohvzsusrnw.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
VITE_CALENDLY_URL=https://calendly.com/your-dev-account
VITE_APP_ENVIRONMENT=development
```

#### `env.staging` (Staging)
```bash
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
VITE_CALENDLY_URL=https://calendly.com/your-staging-account
VITE_APP_ENVIRONMENT=staging
```

#### `env.prod` (Production)
```bash
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-prod-anon-key
VITE_CALENDLY_URL=https://calendly.com/your-prod-account
VITE_APP_ENVIRONMENT=production
VITE_ANALYTICS_ID=your-google-analytics-id
```

### 3. Generate Base64 Encoded Strings

Use the helper script to generate base64 strings for GitHub Secrets:

```bash
# Generate for development
./scripts/generate-env-base64.sh dev

# Generate for staging
./scripts/generate-env-base64.sh staging

# Generate for production
./scripts/generate-env-base64.sh prod
```

### 4. Add GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to: `https://github.com/your-org/your-repo/settings/secrets/actions`
2. Add these secrets:
   - `ENV_DEV_BASE64` - Base64 string from `env.dev`
   - `ENV_STAGING_BASE64` - Base64 string from `env.staging`
   - `ENV_PROD_BASE64` - Base64 string from `env.prod`

## 🚀 How It Works

### Build Process

1. **Environment Detection**: GitHub Actions determines the target environment
2. **Secret Retrieval**: Fetches the appropriate `ENV_*_BASE64` secret
3. **File Generation**: Decodes base64 string and creates `.env` file
4. **Build**: Vite uses the `.env` file during build process
5. **Deployment**: Built assets contain environment-specific configuration

### GitHub Actions Workflow

```yaml
- name: 🔧 Generate Environment Configuration
  env:
    ENVIRONMENT: ${{ needs.environment.outputs.env }}
  run: |
    case "$ENVIRONMENT" in
      "dev")
        ENV_CONFIG="${{ secrets.ENV_DEV_BASE64 }}"
        ;;
      "staging")
        ENV_CONFIG="${{ secrets.ENV_STAGING_BASE64 }}"
        ;;
      "prod")
        ENV_CONFIG="${{ secrets.ENV_PROD_BASE64 }}"
        ;;
    esac
    
    echo "$ENV_CONFIG" | base64 -d > .env
```

## 🔒 Security Considerations

- **Environment files are gitignored** - Never commit actual configuration files
- **AWS Parameter Store encryption** - All sensitive data encrypted with KMS
- **Separate frontend/backend parameters** - Frontend gets only public variables
- **IAM least privilege** - GitHub Actions role has minimal required permissions
- **No secrets in repository** - All sensitive data stored in AWS Parameter Store
- **Placeholder values only** - CloudFormation templates contain no real secrets

## 🛠️ Local Development

For local development, create a `.env` file in the project root:

```bash
cp env.template .env
# Edit .env with your local development values
```

## 📋 Available Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `VITE_CALENDLY_URL` | Calendly booking URL | ❌ | `https://calendly.com/username` |
| `VITE_APP_ENVIRONMENT` | Environment identifier | ❌ | `development`, `staging`, `production` |
| `VITE_ANALYTICS_ID` | Google Analytics ID | ❌ | `G-XXXXXXXXXX` |
| `VITE_SENTRY_DSN` | Sentry error tracking DSN | ❌ | `https://xxx@sentry.io/xxx` |

## 🔄 Updating Environment Configuration

To update environment configuration:

1. Edit the appropriate `env.*` file
2. Run `./scripts/generate-env-base64.sh <environment>`
3. Update the corresponding GitHub Secret
4. Redeploy the application

## 🐛 Troubleshooting

### Build fails with "Environment configuration not found"

- Ensure the GitHub Secret exists: `ENV_<ENVIRONMENT>_BASE64`
- Verify the secret name matches exactly (case-sensitive)
- Check that the base64 string is valid

### Variables not available in application

- Ensure variables start with `VITE_` prefix
- Verify the `.env` file is created during build
- Check GitHub Actions logs for environment generation step

### Base64 encoding issues

- Use the provided script: `./scripts/generate-env-base64.sh`
- Ensure no extra whitespace in the environment file
- Verify the base64 string doesn't contain line breaks
