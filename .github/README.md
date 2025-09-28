# 🚀 GitHub Actions Workflows for TelAgri Bank Dashboard

This directory contains automated deployment workflows for the TelAgri Bank Dashboard, a secure financial platform for agricultural finance management.

## 📋 Available Workflows

### 1. 🔧 Fix Migration Issues (`fix-migrations.yml`)
**Purpose**: Resolve database migration conflicts, specifically the `--include-all` flag issue.

**When to Use**:
- When you see the error: "Found local migration files to be inserted before the last migration on remote database"
- When migrations fail with "Rerun the command with --include-all flag"

**How to Run**:
1. Go to **Actions** tab in GitHub
2. Select **"🔧 Fix Migration Issues"**
3. Click **"Run workflow"**
4. Choose environment (`dev` or `prod`)
5. Set **"Force apply all local migrations"** to `true`
6. Click **"Run workflow"**

### 2. 🗄️ Deploy Database Migrations (`deploy-database.yml`)
**Purpose**: Deploy database changes and Edge Functions automatically.

**Triggers**:
- Push to `main` or `develop` branches (when database files change)
- Pull requests to `main` (validation only)
- Manual workflow dispatch

**Features**:
- Automatic detection of `--include-all` requirement
- Environment-specific deployment (dev/prod)
- Edge Functions deployment
- Secrets configuration
- Post-deployment verification

### 3. 🚀 Deploy Full Stack (`deploy-full-stack.yml`)
**Purpose**: Complete deployment of both database and frontend to AWS.

**Triggers**:
- Push to `main` branch
- Manual workflow dispatch

**Features**:
- Database migration deployment
- Frontend build and AWS deployment
- Health checks and verification
- Environment-specific configuration
- Rollback capabilities

## 🔐 Required Secrets

### Repository Secrets
Configure these in **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Description | Example |
|--------|-------------|---------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access token | `sbp_xxx...` |
| `SUPABASE_PROJECT_ID_DEV` | Development project ID | `jhelkawgkjohvzsusrnw` |
| `SUPABASE_PROJECT_ID_PROD` | Production project ID | `imncjxfppzikerifyukk` |
| `SUPABASE_DB_PASSWORD_DEV` | Development database password | `xxx` |
| `SUPABASE_DB_PASSWORD_PROD` | Production database password | `xxx` |
| `SUPABASE_URL_DEV` | Development Supabase URL | `https://xxx.supabase.co` |
| `SUPABASE_URL_PROD` | Production Supabase URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | Development service role key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Production service role key | `eyJ...` |
| `SENDGRID_API_KEY` | SendGrid API key for emails | `SG.xxx` |
| `SENDGRID_FROM_EMAIL` | From email address | `noreply@telagri.com` |

### Repository Variables
Configure these in **Settings → Secrets and variables → Actions → Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ROLE_ARN` | GitHub Actions AWS role ARN | `arn:aws:iam::xxx:role/GitHubActionsRole` |
| `CERTIFICATE_ARN` | SSL certificate ARN | `arn:aws:acm:us-east-1:xxx:certificate/xxx` |
| `DOMAIN_NAME_DEV` | Development domain | `dashboard-dev.telagri.com` |
| `DOMAIN_NAME_PROD` | Production domain | `dashboard.telagri.com` |

## 🚨 Troubleshooting Migration Issues

### The `--include-all` Problem

**Error Message**:
```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20250117000001_add_specialist_role_and_data_analysis.sql
```

**Solution**:
1. **Quick Fix**: Use the "🔧 Fix Migration Issues" workflow
2. **Manual Fix**: Run locally with `--include-all` flag:
   ```bash
   supabase db push --linked --include-all
   ```

### Why This Happens
- Local migration files exist that haven't been applied to the remote database
- The migration timestamp suggests it should be inserted before existing remote migrations
- Supabase requires explicit confirmation via `--include-all` flag

### Prevention
- Always apply migrations to remote database immediately after creating them
- Use consistent migration naming and timing
- Test migrations in development before production

## 🔄 Workflow Execution Order

### For Database Changes:
1. **Development**: Push to `develop` → Triggers database deployment to dev
2. **Production**: Push to `main` → Triggers database deployment to prod
3. **Manual**: Use workflow dispatch for specific environments

### For Full Deployment:
1. **Database Migration** → **Frontend Build** → **AWS Deployment** → **Health Check**

## 📊 Monitoring Deployments

### GitHub Actions Dashboard
- Monitor progress in **Actions** tab
- Check individual job logs for detailed information
- Review deployment summaries in job outputs

### Key Indicators
- ✅ **Green checkmarks**: Successful deployment
- ❌ **Red X**: Failed deployment (check logs)
- 🟡 **Yellow dot**: In progress
- ⏭️ **Skipped**: Job was skipped (intentional)

## 🛠️ Development Workflow

### Making Database Changes
1. Create migration: `supabase migration new your_migration_name`
2. Write migration SQL
3. Test locally: `supabase db reset && supabase db push`
4. Commit and push to `develop` branch
5. Verify deployment in development environment
6. Merge to `main` for production deployment

### Making Frontend Changes
1. Develop and test locally
2. Ensure build passes: `npm run build`
3. Commit and push to feature branch
4. Create PR to `main`
5. After merge, automatic deployment to production

## 🔐 Security Best Practices

### Secrets Management
- ✅ Use GitHub Secrets for sensitive data
- ✅ Use Repository Variables for non-sensitive configuration
- ✅ Rotate secrets regularly
- ❌ Never commit secrets to repository

### Environment Isolation
- ✅ Separate dev and prod environments completely
- ✅ Use different Supabase projects for each environment
- ✅ Test all changes in development first
- ❌ Never test directly in production

### Access Control
- ✅ Limit who can trigger manual workflows
- ✅ Require PR reviews for main branch
- ✅ Use environment protection rules
- ❌ Don't give unnecessary permissions

## 📞 Support

### Common Issues
1. **Migration Conflicts**: Use "Fix Migration Issues" workflow
2. **AWS Deployment Failures**: Check AWS credentials and permissions
3. **Build Failures**: Verify all dependencies and environment variables
4. **Secret Issues**: Ensure all required secrets are configured

### Getting Help
1. Check workflow logs for specific error messages
2. Review this documentation
3. Check the main project documentation in `/docs`
4. Contact the development team

---

**🌾 TelAgri Bank Dashboard - Serving farmers with banking-grade reliability! 🏦**
