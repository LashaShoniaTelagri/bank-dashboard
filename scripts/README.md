# TelAgri Monitoring - Scripts Directory

## 🧹 **Clean and Organized Scripts**

This directory contains only the essential, actively maintained scripts for TelAgri Monitoring.

## 📁 **Active Scripts**

### **🚀 Deployment & Operations**
- **`deploy-all.sh`** - Main deployment script with auto-discovery of Edge Functions
- **`fetch-env-from-aws.sh`** - Fetch environment configuration from AWS Parameter Store

### **⚙️ Environment Management**
- **`manage-env.sh`** - Interactive Parameter Store management (recommended)
- **`update-parameter-store.sh`** - Update AWS Parameter Store with local env files

### **👤 Admin Management**
- **`add-system-admin.sh`** - Interactive admin user creation
- **`create-admin-user.sh`** - Admin user creation with environment selection
- **`create-admin-simple.sh`** - Simple admin SQL generator
- **`create-admin.sql`** - Admin creation SQL template
- **`create-admin-simple-manual.sql`** - Manual admin creation SQL

### **⚙️ Setup & Configuration**
- **`setup-cdk.sh`** - CDK infrastructure setup
- **`setup-dev-env.sh`** - Development environment configuration
- **`generate-pwa-icons.sh`** - PWA icon generation

## 🗂️ **Archived Scripts**

Obsolete scripts from debugging and development phases have been moved to `archive-obsolete/`:

### **Migration Debugging Scripts** (No longer needed)
- Multiple SQL files used during database migration troubleshooting
- Various shell scripts for environment setup that are now automated

### **Why Archived?**
- ✅ **Database migrations now work reliably** through proper Supabase CLI
- ✅ **Environment management automated** via AWS Parameter Store
- ✅ **Edge Functions deployment automated** with auto-discovery
- ✅ **CDK infrastructure integrated** with Parameter Store setup

## 🎯 **Usage Examples**

### **Deploy Everything**
```bash
./scripts/deploy-all.sh --environment dev
```

### **Manage Parameter Store (Interactive)**
```bash
./scripts/manage-env.sh
```

### **Update Parameter Store (Direct)**
```bash
# Update dev backend environment
./scripts/update-parameter-store.sh backend dev

# Update prod frontend environment  
./scripts/update-parameter-store.sh frontend prod

# Update with custom file
./scripts/update-parameter-store.sh backend dev my-custom.env
```

### **Create Admin User**
```bash
./scripts/add-system-admin.sh
```

### **Setup Development Environment**
```bash
./scripts/setup-dev-env.sh
```

### **Fetch Environment from AWS**
```bash
./scripts/fetch-env-from-aws.sh dev
```

## 🔒 **Security Notes**

- All scripts use secure placeholder values
- Real secrets managed via AWS Parameter Store
- No sensitive data committed to version control
- Environment-specific configurations isolated

## 📚 **Documentation**

For detailed usage instructions, see:
- `docs/deployment/` - Deployment guides
- `docs/setup/` - Setup instructions
- `docs/security/` - Security best practices

## 🧹 **Maintenance**

This directory is kept clean and focused. Obsolete scripts are archived rather than deleted to maintain project history while keeping the active workspace uncluttered.
