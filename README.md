# 🌾 TelAgri Bank Dashboard

**Secure AgriTech Financial Platform for Farmer Loan Management**

A production-grade banking dashboard that enables financial institutions to manage farmer loans, F-100 agricultural reports, and partnership operations. Built with security, performance, and rural accessibility in mind.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or bun
- Supabase CLI
- Git

### Local Development
```bash
# Clone repository
git clone <repository-url>
cd telagri-bank-dashboard

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev

# Start Supabase (in separate terminal)
supabase start
supabase functions serve
```

Visit `http://localhost:8080` to access the dashboard.

## 🏗️ Architecture

### **Frontend Stack**
- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **shadcn/ui** component library with Tailwind CSS
- **TanStack Query** for efficient data fetching
- **React Hook Form + Zod** for form management

### **Backend & Services**
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- **SendGrid** for reliable email delivery
- **Row-Level Security (RLS)** for data isolation
- **2FA Authentication** with email verification

### **Security Features**
- 🔐 **Two-Factor Authentication** for all users
- 🛡️ **Role-based permissions** (Admin, Bank Viewer)
- 🔒 **Row-Level Security** policies
- 🚫 **Rate limiting** and brute force protection
- ✅ **Input validation** and sanitization

## 📊 Key Features

### **👥 User Management**
- Admin and Bank Viewer roles
- Secure invitation system
- 2FA email verification
- Session management

### **🏦 Bank Operations**
- Bank partnership management
- CRUD operations with permissions
- Data isolation between banks
- Audit trails

### **👨‍🌾 Farmer Management**
- Comprehensive farmer profiles
- Loan tracking and history
- Agricultural data management
- Mobile-optimized interface

### **📄 F-100 Reports**
- PDF upload and storage
- Report validation
- Access control by bank
- Agricultural compliance tracking

## 🔧 Development

### **Project Structure**
```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   └── *Management.tsx # Feature components
├── pages/              # Route-based pages
├── hooks/              # Custom React hooks
├── integrations/       # External service clients
└── lib/               # Utility functions

supabase/
├── migrations/        # Database schema versions
├── functions/         # Edge Functions
└── config.toml       # Supabase configuration
```

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking
npm test            # Run test suite
```

### **Database Management**
```bash
# Create new migration
supabase migration new migration_name

# Apply migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy function_name

# View logs
supabase functions logs function_name
```

### **🗄️ Database Migrations in CI/CD**

Database migrations are automatically handled in GitHub Actions:

**Automatic Migration**: Runs on every deployment
- Migrations execute **before** AWS deployment
- Failed migrations prevent broken deployments
- Environment-specific project targeting

**Manual Migration Control**: Use the dedicated workflow
```bash
# Access via GitHub Actions → "🗄️ Database Migrations"
Actions: push | list | repair | reset (destructive)
Environments: dev | staging | prod
```

**Setup Requirements**:
```bash
# Validate your setup
./scripts/validate-migration-setup.sh

# Required GitHub secrets:
SUPABASE_ACCESS_TOKEN    # From Supabase dashboard
SUPABASE_PROJECT_ID      # Your project ID

# Optional environment-specific IDs:
SUPABASE_PROJECT_ID_DEV
SUPABASE_PROJECT_ID_STAGING  
SUPABASE_PROJECT_ID_PROD
```

📖 **Complete setup guide**: [SUPABASE_MIGRATIONS_SETUP.md](./SUPABASE_MIGRATIONS_SETUP.md)

## 🔐 Security

This application handles sensitive financial data and implements banking-grade security:

- **Authentication**: Supabase Auth with 2FA
- **Authorization**: Role-based access control
- **Data Protection**: RLS policies and encryption
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: API protection
- **Audit Logging**: Complete activity tracking

## 🚀 Deployment

### **AWS Production Setup**
The application is designed for AWS deployment with:
- **S3 + CloudFront** for frontend hosting
- **Route 53** for DNS management
- **Certificate Manager** for SSL
- **WAF** for additional security
- **CloudWatch** for monitoring

See [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md) for complete deployment instructions.

### **CI/CD Pipeline**
GitHub Actions workflow includes:
- Automated testing and linting
- Security vulnerability scanning
- **🗄️ Database migration deployment**
- Performance testing with Lighthouse
- Automated deployment to AWS
- Supabase function deployment

## 📋 Configuration

### **Environment Variables**
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Application Settings
VITE_APP_URL=http://localhost:8080
NODE_ENV=development

# Email Service (SendGrid)
SENDGRID_API_KEY=your-sendgrid-key
```

### **Cursor Rules**
This project includes comprehensive Cursor rules in `.cursorrules` for:
- Security best practices
- Component patterns
- Database guidelines
- Performance optimization
- Agricultural domain knowledge

## 🧪 Testing

### **Test Coverage**
- Unit tests for components and utilities
- Integration tests for API endpoints
- E2E tests for critical user flows
- Security tests for authentication
- Performance tests for optimization

### **Critical Test Scenarios**
1. **Authentication Flow**: Login + 2FA verification
2. **Role Permissions**: Admin vs Bank Viewer access
3. **Data Isolation**: Bank-specific data access
4. **File Upload**: F-100 PDF handling
5. **Email Delivery**: Invitation and 2FA emails

## 📚 Documentation

- **[.cursorrules](./.cursorrules)** - Development guidelines and patterns
- **[PROJECT_PROMPT.md](./PROJECT_PROMPT.md)** - Comprehensive project context
- **[AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)** - Production deployment
- **Database Schema** - Available in `supabase/migrations/`
- **API Documentation** - Inline in Edge Functions

## 🌱 Agricultural Context

This platform serves the AgriTech sector with specific considerations for:
- **F-100 Compliance**: Agricultural reporting standards
- **Seasonal Patterns**: Loan cycles aligned with farming seasons
- **Rural Connectivity**: Optimized for mobile and low-bandwidth
- **Multi-Currency**: Support for international markets
- **Offline Capability**: Progressive enhancement for field usage

## 🎯 Performance

### **Optimization Targets**
- Page load time < 2 seconds
- First contentful paint < 1.5 seconds
- Mobile-first responsive design
- Bundle size < 1MB
- Database queries < 100ms

### **Monitoring**
- Real User Monitoring (RUM)
- Synthetic performance testing
- Database query analysis
- Error tracking and alerting
- User experience metrics

## 🤝 Contributing

1. Follow the patterns established in `.cursorrules`
2. Ensure all tests pass before submitting PR
3. Include security impact assessment
4. Consider agricultural domain implications
5. Test on mobile devices for field usage

## 📞 Support

For technical issues or questions:
- Check existing documentation first
- Review console logs for debugging
- Test with sample data in development
- Contact technical lead for complex issues

---

## 🌟 Key Success Metrics

**Security**: Zero data breaches, 100% HTTPS traffic
**Performance**: < 2s page loads, 99.9% uptime
**User Experience**: > 95% task completion rate
**Agricultural Impact**: Improved farmer access to credit

**Remember: This platform directly impacts farmers' livelihoods and access to agricultural financing. Every feature and optimization contributes to agricultural success and food security.**
