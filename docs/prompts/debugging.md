# 🐛 Debugging & Troubleshooting Prompts

**Systematic prompts for debugging issues and resolving problems in TelAgri Bank Dashboard**

---

## 🔍 **1. General Bug Investigation**

### **Prompt: Bug Analysis & Root Cause**
```markdown
# BUG INVESTIGATION - {BUG_DESCRIPTION}

## Context
I'm investigating a bug in TelAgri Bank Dashboard, a banking-grade AgriTech platform handling sensitive farmer financial data.

**Tech Stack Context:**
- Frontend: React 19 + TypeScript 5.8+ + Vite + shadcn/ui + Tailwind CSS
- Package Manager: Bun 1.x
- Backend: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Security: 2FA, RLS, JWT tokens, rate limiting, trusted devices

## Bug Description
**Issue:** {DETAILED_BUG_DESCRIPTION}
**Steps to Reproduce:** 
1. {STEP_1}
2. {STEP_2}
3. {STEP_3}

**Expected Behavior:** {WHAT_SHOULD_HAPPEN}
**Actual Behavior:** {WHAT_ACTUALLY_HAPPENS}
**Environment:** {DEVELOPMENT/STAGING/PRODUCTION}
**User Role:** {ADMINISTRATOR/BANK_VIEWER/READ_ONLY}

## Investigation Areas
1. **Frontend Issues**: React component errors, state management, UI rendering
2. **Backend Issues**: Database queries, Edge Functions, authentication
3. **Network Issues**: API calls, connectivity, timeout problems
4. **Security Issues**: Permission errors, authentication failures
5. **Performance Issues**: Slow loading, memory leaks, bundle size
6. **Browser/Device Issues**: Compatibility, mobile-specific problems

## Error Information
**Console Errors:** {PASTE_CONSOLE_ERRORS}
**Network Errors:** {PASTE_NETWORK_TAB_ERRORS}
**Supabase Logs:** {PASTE_SUPABASE_ERROR_LOGS}
**Server Logs:** {PASTE_SERVER_LOGS_IF_AVAILABLE}

## Expected Analysis
- **Root Cause Identification**: What's causing the issue?
- **Impact Assessment**: How does this affect users and business?
- **Reproduction Steps**: Reliable way to reproduce the bug
- **Fix Strategy**: Approach to resolve the issue
- **Testing Plan**: How to verify the fix works
- **Prevention**: How to prevent similar issues

## Agricultural Context
Consider impact on farmers in rural areas with limited connectivity and varying technical literacy.
```

---

## ⚡ **2. Performance Issues**

### **Prompt: Performance Debugging**
```markdown
# PERFORMANCE DEBUGGING - {PERFORMANCE_ISSUE}

## Context
Investigating performance issues in TelAgri Bank Dashboard affecting user experience, particularly for rural users with limited connectivity.

**Performance Targets:**
- Lighthouse Score: 95+ (Performance, Accessibility, Best Practices, SEO)
- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- Mobile Performance: Optimized for rural 3G connections

## Performance Issue
**Problem:** {DESCRIBE_PERFORMANCE_PROBLEM}
**Affected Areas:** {SPECIFIC_PAGES_OR_COMPONENTS}
**User Impact:** {HOW_USERS_ARE_AFFECTED}
**Metrics:** {LIGHTHOUSE_SCORES_OR_TIMING_DATA}

## Investigation Areas
1. **React Performance**
   - Component re-rendering issues
   - Unnecessary state updates
   - Memory leaks in useEffect
   - Large component trees

2. **Bundle Analysis**
   - Bundle size increases
   - Unused dependencies
   - Code splitting effectiveness
   - Import optimization

3. **Network Performance**
   - API response times
   - Database query performance
   - Image and asset optimization
   - Caching effectiveness

4. **Browser Performance**
   - JavaScript execution time
   - DOM manipulation costs
   - CSS rendering performance
   - Paint and layout thrashing

## Debugging Tools Needed
- React DevTools Profiler analysis
- Chrome DevTools Performance tab
- Lighthouse report comparison
- Bundle analyzer results
- Supabase query performance logs

## Expected Output
- **Performance Bottlenecks**: Specific issues causing slowness
- **Optimization Plan**: Prioritized list of improvements
- **Code Changes**: Specific optimizations to implement
- **Measurement Strategy**: How to track improvements
- **Rural Connectivity Impact**: Special considerations for farmers
```

---

## 🔐 **3. Authentication & Security Issues**

### **Prompt: Authentication Debugging**
```markdown
# AUTHENTICATION DEBUG - {AUTH_ISSUE}

## Context
Debugging authentication/authorization issues in TelAgri Bank Dashboard's banking-grade security system.

**Security Architecture:**
- Supabase Auth with custom claims
- 2FA with email verification
- Trusted device system (30-day trust)
- Role-based access control (Administrator, BankViewer, ReadOnly)
- Row Level Security (RLS) policies

## Authentication Issue
**Problem:** {DESCRIBE_AUTH_ISSUE}
**User Role:** {AFFECTED_USER_ROLE}
**Steps to Reproduce:** {STEP_BY_STEP_REPRODUCTION}
**Error Messages:** {PASTE_ERROR_MESSAGES}

## Investigation Areas
1. **Login Process**
   - Email/password validation
   - 2FA code generation and verification
   - Session creation and management
   - Trusted device recognition

2. **Authorization Checks**
   - Role verification
   - Permission validation
   - RLS policy enforcement
   - Component-level access control

3. **Token Management**
   - JWT token validation
   - Token refresh mechanism
   - Session expiration handling
   - Cross-tab session sync

4. **Database Security**
   - RLS policy debugging
   - User context verification
   - Multi-tenant data isolation
   - Audit trail logging

## Debugging Information Needed
- Supabase Auth logs
- Browser network tab (authentication requests)
- Database query logs
- RLS policy execution logs
- Console error messages

## Expected Analysis
- **Authentication Flow**: Step-by-step analysis of auth process
- **Permission Issues**: Specific authorization failures
- **Database Access**: RLS policy compliance check
- **Security Gaps**: Potential security vulnerabilities
- **Fix Implementation**: Secure solution approach
- **Testing Strategy**: How to verify security fixes
```

---

## 💾 **4. Database Issues**

### **Prompt: Database Debugging**
```markdown
# DATABASE DEBUG - {DATABASE_ISSUE}

## Context
Debugging database issues in TelAgri Bank Dashboard's Supabase PostgreSQL setup with Row Level Security.

**Database Architecture:**
- PostgreSQL with Supabase
- Row Level Security (RLS) policies
- Multi-tenant data isolation (bank-specific data)
- Audit trails for financial data
- Performance indexes for farmer/bank queries

## Database Issue
**Problem:** {DESCRIBE_DATABASE_ISSUE}
**Affected Tables:** {SPECIFIC_TABLES_INVOLVED}
**Query Patterns:** {DESCRIBE_QUERY_PATTERNS}
**Error Messages:** {PASTE_DATABASE_ERRORS}

## Investigation Areas
1. **Query Performance**
   - Slow query identification
   - Index usage analysis
   - N+1 query problems
   - Connection pool issues

2. **Data Integrity**
   - Constraint violations
   - Foreign key issues
   - Data corruption checks
   - Transaction rollback problems

3. **Security Issues**
   - RLS policy failures
   - Unauthorized data access
   - Cross-tenant data leakage
   - Audit trail gaps

4. **Schema Issues**
   - Migration failures
   - Column type mismatches
   - Relationship problems
   - Index inefficiencies

## Debugging Tools
- EXPLAIN ANALYZE query plans
- pg_stat_statements for slow queries
- Supabase dashboard query logs
- PostgreSQL log analysis
- RLS policy testing

## Expected Analysis
- **Query Optimization**: Specific query improvements needed
- **Schema Issues**: Database design problems and solutions
- **Security Verification**: RLS policy compliance check
- **Performance Tuning**: Index and query optimizations
- **Data Integrity**: Consistency and constraint verification
- **Migration Safety**: Safe deployment and rollback plans
```

---

## 🌐 **5. Network & API Issues**

### **Prompt: Network Debugging**
```markdown
# NETWORK DEBUG - {NETWORK_ISSUE}

## Context
Debugging network and API issues in TelAgri Bank Dashboard, considering rural connectivity challenges.

**Network Architecture:**
- Supabase API for database operations
- Edge Functions for business logic
- SendGrid for email delivery
- AWS CDK deployment with CloudFront
- Rural connectivity optimization

## Network Issue
**Problem:** {DESCRIBE_NETWORK_ISSUE}
**Affected APIs:** {SPECIFIC_API_ENDPOINTS}
**Network Conditions:** {CONNECTION_TYPE_AND_SPEED}
**Error Patterns:** {PASTE_NETWORK_ERRORS}

## Investigation Areas
1. **API Issues**
   - Request/response analysis
   - Status code investigation
   - Payload size optimization
   - Rate limiting problems

2. **Connectivity Issues**
   - Rural network reliability
   - Mobile vs desktop differences
   - Offline capability gaps
   - Connection timeout handling

3. **Supabase Integration**
   - RPC function failures
   - Real-time subscription issues
   - Authentication token problems
   - Edge Function errors

4. **Performance Issues**
   - Large payload sizes
   - Excessive API calls
   - Missing caching strategies
   - CDN effectiveness

## Rural Connectivity Considerations
- 3G network performance
- Intermittent connectivity handling
- Offline-first capabilities
- Data usage optimization
- Progressive loading strategies

## Expected Analysis
- **Network Performance**: Specific bottlenecks and optimizations
- **API Optimization**: Request/response improvements
- **Error Handling**: Better network error management
- **Rural Compatibility**: Specific improvements for rural users
- **Caching Strategy**: Effective caching implementation
- **Monitoring**: Network performance tracking
```

---

## 🎨 **6. UI/UX Issues**

### **Prompt: UI/UX Debugging**
```markdown
# UI/UX DEBUG - {UI_ISSUE}

## Context
Debugging UI/UX issues in TelAgri Bank Dashboard, focusing on rural user experience and accessibility.

**Design System:**
- shadcn/ui component library
- Tailwind CSS for styling  
- Mobile-first responsive design
- WCAG 2.1 AA accessibility compliance
- Agricultural domain considerations

## UI/UX Issue
**Problem:** {DESCRIBE_UI_ISSUE}
**Affected Components:** {SPECIFIC_COMPONENTS}
**User Impact:** {HOW_USERS_ARE_AFFECTED}
**Device/Browser:** {DEVICE_AND_BROWSER_INFO}

## Investigation Areas
1. **Visual Issues**
   - Layout problems
   - Styling inconsistencies
   - Responsive design failures
   - Color and typography issues

2. **Interaction Issues**
   - Form validation problems
   - Button and link functionality
   - Navigation difficulties
   - Touch interaction problems

3. **Accessibility Issues**
   - Screen reader compatibility
   - Keyboard navigation problems
   - Color contrast failures
   - ARIA label missing/incorrect

4. **Performance Issues**
   - UI rendering performance
   - Animation stuttering
   - Large DOM issues
   - CSS performance problems

## Rural User Considerations
- Field usage scenarios (outdoor, mobile)
- Varying technical literacy levels
- Limited data plans
- Older device compatibility

## Expected Analysis
- **UI Fixes**: Specific visual and interaction improvements
- **Accessibility Compliance**: WCAG compliance gaps and solutions
- **Responsive Issues**: Mobile/tablet/desktop layout fixes
- **Performance Optimization**: UI rendering improvements
- **User Experience**: Better farmer workflow support
- **Testing Strategy**: How to verify UI/UX fixes
```

---

## 🔄 **7. Quick Debugging Checklist**

### **Prompt: Rapid Issue Diagnosis**
```markdown
# QUICK DEBUG - {ISSUE_SUMMARY}

## Context
Quick diagnosis for {ISSUE_SUMMARY} in TelAgri Bank Dashboard.

**Issue:** {ONE_LINE_ISSUE_DESCRIPTION}
**Environment:** {DEV/STAGING/PROD}
**Urgency:** {HIGH/MEDIUM/LOW}

## Rapid Diagnosis Checklist
- [ ] **Console Errors**: Any JavaScript errors in browser console?
- [ ] **Network Tab**: Any failed API requests or timeouts?
- [ ] **Authentication**: User properly logged in with correct role?
- [ ] **Permissions**: Does user have required permissions for action?
- [ ] **Database**: Are RLS policies blocking data access?
- [ ] **Supabase Status**: Any Supabase service outages?
- [ ] **Recent Changes**: Any recent deployments or code changes?
- [ ] **Browser/Device**: Issue specific to certain browsers/devices?

## Quick Actions
1. **Immediate**: What can be done right now to fix/mitigate?
2. **Short-term**: What needs to be fixed in next 24 hours?
3. **Long-term**: What systemic improvements are needed?

## Expected Output
- **Root Cause**: Most likely cause of the issue
- **Quick Fix**: Immediate action to resolve or mitigate
- **Full Solution**: Complete solution if quick fix isn't sufficient
- **Prevention**: How to prevent similar issues
```

---

**💡 Debugging Tips:**
- Always start with browser console and network tab
- Check Supabase logs for backend issues
- Consider rural connectivity impact
- Test across different user roles and permissions
- Use systematic elimination to isolate issues 