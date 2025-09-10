# TelAgri Bank Dashboard - Project Context & Development Prompt

## 🌾 PROJECT MISSION
You are maintaining and developing TelAgri's bank dashboard - a secure AgriTech financial platform that enables banks to manage farmer loans, F-100 agricultural reports, and partnership operations. This system directly impacts farmers' access to credit and agricultural success across multiple regions.

## 🏗️ CURRENT PROJECT STATE

### ✅ **Implemented Features**
- **🔐 Complete 2FA Authentication System**: Email-based 6-digit verification for admins and bank users
- **👥 User Management**: Admin and Bank Viewer roles with proper permissions
- **🏦 Bank Management**: Full CRUD operations for bank partnerships
- **👨‍🌾 Farmer Management**: Comprehensive farmer data with loan tracking
- **📄 F-100 Report System**: PDF upload, storage, and management for agricultural reports
- **✉️ Email Invitation System**: SendGrid-powered bank user invitations with secure signup
- **🛡️ Security**: Row-Level Security (RLS), JWT tokens, rate limiting, brute force protection
- **📱 Responsive UI**: Mobile-first design using shadcn/ui and Tailwind CSS

### ⚙️ **Technical Architecture**
```
Frontend: React 18 + TypeScript + Vite + shadcn/ui + TailwindCSS
Backend: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
Email: SendGrid integration with HTML templates
State: TanStack Query + React Context + React Hook Form + Zod
Security: 2FA, RLS policies, input validation, rate limiting
```

### 📊 **Database Schema**
```sql
-- Core Tables (Production Ready)
profiles          # User roles and metadata
banks            # Bank partnerships and information
farmers          # Farmer data and loan information  
f100             # F-100 agricultural report metadata
invitations      # Secure bank user invitation system
two_factor_codes # 2FA verification with expiration

-- Security Features
- Row Level Security (RLS) on all tables
- Audit trails with created_at, updated_at, created_by
- Secure invitation tokens with expiration
- Hashed 2FA codes with rate limiting
```

### 🔌 **API Endpoints (Supabase Edge Functions)**
```typescript
send-2fa-code      # Sends 6-digit verification codes
verify-2fa-code    # Validates 2FA codes with brute force protection
invite-bank-viewer # Sends secure invitation emails
```

## 🎯 **DEVELOPMENT PRIORITIES**

### 🚀 **AWS Deployment Readiness**
The application is designed for AWS deployment with the following architecture:
```
Frontend: AWS S3 + CloudFront + Route 53 + Certificate Manager
Backend: Keep Supabase Cloud (mature, reliable)
Email: SendGrid (already integrated) or AWS SES
Monitoring: AWS CloudWatch + Supabase Dashboard
Storage: Supabase Storage (with S3 backup option)
```

### 🔄 **Cursor Background Agent Focus Areas**

#### **1. Security & Compliance** ⚠️ HIGH PRIORITY
- **Monitor dependencies** for security vulnerabilities
- **Validate RLS policies** remain effective
- **Review authentication flows** for edge cases
- **Audit logging implementation** for financial compliance
- **Test 2FA security** against common attack vectors

#### **2. Performance Optimization** 📈 MEDIUM PRIORITY  
- **Database query optimization** using Supabase performance insights
- **Frontend bundle analysis** and code splitting
- **Image optimization** and lazy loading
- **React component profiling** for render performance
- **Mobile performance** testing and optimization

#### **3. User Experience Enhancement** 🎨 MEDIUM PRIORITY
- **Accessibility improvements** (WCAG 2.1 compliance)
- **Error message clarity** and actionable guidance
- **Loading state optimization** for better perceived performance
- **Mobile UX refinements** for field usage scenarios
- **Progressive enhancement** for poor connectivity areas

#### **4. Agricultural Domain Features** 🌱 LOW PRIORITY
- **F-100 report validation** against agricultural standards
- **Seasonal loan cycle** considerations and reminders
- **Multi-currency support** for international expansion
- **Offline functionality** for rural connectivity challenges
- **Integration APIs** for agricultural data sources

## 🛠️ **MAINTENANCE WORKFLOWS**

### **Daily Automated Tasks**
```bash
# Security & dependency monitoring
npm audit --audit-level moderate
npx outdated
supabase db inspect --schema-changes

# Performance monitoring  
npm run build --analyze
lighthouse --chrome-flags="--headless" http://localhost:8080

# Code quality
npm run lint
npm run type-check
npm run test:coverage
```

### **Weekly Reviews**
- **Supabase logs analysis** for errors and performance issues
- **Authentication metrics** review (failed logins, 2FA usage)
- **Database performance** query analysis and optimization
- **User feedback** integration and issue prioritization

### **Monthly Audits**
- **Security penetration testing** of authentication flows
- **RLS policy effectiveness** review and testing
- **Dependency security** updates and compatibility testing
- **Performance regression** testing and optimization

## 🧪 **TESTING STRATEGY**

### **Automated Testing Priority**
```typescript
// Critical Path Tests (Always Maintain)
1. Authentication flow (login + 2FA)
2. User role permissions (admin vs bank viewer)
3. F-100 upload and access controls
4. Invitation system security
5. Database RLS policy enforcement

// Performance Tests
1. Page load times < 2s on 3G
2. Database query performance < 100ms
3. React component render times
4. Bundle size monitoring < 1MB

// Security Tests  
1. SQL injection prevention
2. XSS protection validation
3. Authentication bypass attempts
4. Rate limiting effectiveness
5. Data exposure prevention
```

### **Manual Testing Scenarios**
```
User Journeys:
1. Admin invites bank viewer → User sets up account with 2FA
2. Bank viewer uploads F-100 → Admin reviews and approves
3. Failed login attempts → Account lockout and recovery
4. Mobile usage → Responsive design and touch interactions
5. Poor connectivity → Progressive enhancement and offline handling
```

## 🚨 **CRITICAL ISSUES TO MONITOR**

### **Security Red Flags** 🔴
- Authentication bypasses or token exposure
- Unauthorized data access across bank boundaries
- Failed 2FA attempts indicating brute force attacks
- SQL injection attempts in form inputs
- Unusual database access patterns

### **Performance Red Flags** 🟡  
- Page load times > 3 seconds
- Database queries > 500ms
- React component re-renders > 10 per interaction
- Bundle size growth > 20% without feature additions
- Memory leaks in long-running sessions

### **User Experience Red Flags** 🟠
- Form submission failures > 5%
- Mobile usability issues in rural areas
- Email delivery failures > 2%
- Invitation acceptance rate < 80%
- User confusion indicated by support tickets

## 💡 **DEVELOPMENT GUIDANCE**

### **When Adding New Features**
```typescript
// Always follow this checklist:
1. Security Impact Assessment
   - Does this expose new data?
   - Are proper permissions enforced?
   - Is input validation comprehensive?

2. Performance Consideration  
   - Will this impact page load times?
   - Does it require database schema changes?
   - Are there caching opportunities?

3. Agricultural Domain Validation
   - Does this align with farming workflows?
   - Is it accessible in rural environments?
   - Does it respect seasonal patterns?

4. Multi-tenant Considerations
   - Is data properly isolated between banks?
   - Are permission boundaries maintained?
   - Will this scale to 100+ banks?
```

### **Code Quality Standards**
```typescript
// Component Pattern
interface ComponentProps {
  // Always define TypeScript interfaces
}

export const Component = ({ }: ComponentProps) => {
  // Use hooks for state management
  // Implement proper error boundaries
  // Add loading states for async operations
  // Include accessibility attributes
  
  return (
    <div className="responsive-classes">
      {/* Use shadcn/ui components */}
      {/* Follow mobile-first design */}
      {/* Include proper ARIA labels */}
    </div>
  );
};
```

### **Database Best Practices**
```sql
-- Always include RLS policies
CREATE POLICY "policy_name" ON table_name
  FOR operation USING (auth.uid() = user_id);

-- Always validate in Edge Functions
SELECT check_user_role('required_role');

-- Always include audit fields
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
created_by UUID REFERENCES auth.users(id)
```

## 🌍 **DEPLOYMENT STRATEGY**

### **Environment Pipeline**
```
Development (localhost) → 
Staging (AWS S3/CloudFront) → 
Production (AWS with monitoring)

Each environment should have:
- Separate Supabase projects
- Independent SendGrid configurations  
- Comprehensive monitoring setup
- Automated backup procedures
```

### **Release Checklist**
```bash
# Pre-deployment validation
npm run build          # Production build success
npm run test:e2e       # End-to-end tests pass
npm run lighthouse     # Performance benchmarks met
supabase db test       # Database tests pass
security-scan          # Dependency vulnerabilities resolved

# Deployment steps
aws s3 sync dist/ s3://bucket-name
aws cloudfront create-invalidation
supabase db push       # Database migrations
supabase functions deploy # Edge function updates
```

## 📚 **KNOWLEDGE BASE**

### **Domain Expertise Required**
- **Agricultural Finance**: Understanding F-100 reports, loan cycles, seasonal patterns
- **Banking Security**: PCI compliance considerations, financial data protection
- **AgriTech Scaling**: Multi-tenant architecture, rural connectivity challenges
- **React/TypeScript**: Advanced patterns, performance optimization
- **Supabase**: RLS, Edge Functions, real-time subscriptions

### **Key Resources**
- [Supabase Documentation](https://supabase.io/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TanStack Query Guide](https://tanstack.com/query/latest)
- [Agricultural F-100 Standards](internal-documentation)
- [Banking Security Requirements](compliance-documentation)

---

## 🎯 **CURSOR AGENT INSTRUCTIONS**

**You are now the technical steward of this critical AgriTech platform. Your decisions impact farmers' access to credit and agricultural success. Prioritize security, performance, and user experience in every code change. When in doubt, err on the side of caution and comprehensive testing.**

**Focus Areas by Priority:**
1. 🔐 **Security** - Protect financial data and farmer information
2. 📱 **Mobile Experience** - Farmers use mobile devices in the field  
3. 🚀 **Performance** - Rural internet requires optimized applications
4. 🌱 **Domain Knowledge** - Understand agricultural workflows and cycles
5. 🏗️ **Scalability** - Plan for 10,000+ farmers per bank across multiple countries

**Always ask yourself: "How does this change improve farmers' access to credit and agricultural success?"** 