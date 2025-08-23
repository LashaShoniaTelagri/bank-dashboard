# 🔍 Code Review Prompts

**Systematic prompts for code quality assurance and comprehensive reviews**

---

## 📋 **1. General Code Review**

### **Prompt: Comprehensive Code Review**
```markdown
# CODE REVIEW - {FEATURE_NAME}

## Context
I need a comprehensive code review for the {FEATURE_NAME} implementation in TelAgri Bank Dashboard, focusing on production readiness for a banking-grade financial platform.

**Code to Review:**
{PASTE_CODE_HERE_OR_DESCRIBE_FILES}

## Review Areas
1. **Type Safety**: TypeScript usage, proper interfaces, no `any` types
2. **Security**: Input validation, authentication, authorization, data exposure
3. **Performance**: React optimization, query efficiency, bundle impact
4. **Accessibility**: WCAG 2.1 AA compliance, semantic HTML, ARIA
5. **Error Handling**: Comprehensive error boundaries, user-friendly messages
6. **Testing**: Test coverage, edge cases, mocking strategies
7. **Code Quality**: Readability, maintainability, patterns consistency
8. **Business Logic**: Correctness, edge cases, domain requirements

## Security Focus Areas
- Row Level Security (RLS) policy compliance
- Input sanitization and validation (Zod schemas)
- Authentication and authorization checks
- Sensitive data exposure prevention
- SQL injection prevention
- CSRF and XSS protection

## Performance Considerations
- React rendering optimization (memo, useMemo, useCallback)
- Database query efficiency and N+1 prevention
- Bundle size impact and code splitting
- Core Web Vitals impact (LCP, FID, CLS)
- Memory leaks and cleanup

## Expected Output
- **Security Issues**: High, medium, low priority security concerns
- **Performance Issues**: Specific optimization recommendations
- **Type Safety Issues**: TypeScript improvements needed
- **Accessibility Issues**: WCAG compliance gaps
- **Code Quality**: Maintainability and readability improvements
- **Testing Gaps**: Missing test coverage areas
- **Best Practices**: Alignment with TelAgri patterns
- **Actionable Recommendations**: Prioritized list of improvements

## Agricultural Context
Consider the impact on rural users, mobile connectivity, and farmer workflow requirements.
```

---

## 🔐 **2. Security-Focused Review**

### **Prompt: Security Audit**
```markdown
# SECURITY AUDIT - {FEATURE_NAME}

## Context
Perform a banking-grade security audit for {FEATURE_NAME} in TelAgri Bank Dashboard. This handles sensitive farmer financial data and must meet strict security requirements.

**Code/Feature to Audit:**
{DESCRIBE_FEATURE_OR_PASTE_CODE}

## Security Checklist
1. **Authentication & Authorization**
   - Proper user authentication verification
   - Role-based access control implementation
   - Permission validation on all operations
   - Session management and timeout

2. **Data Protection**
   - Input validation and sanitization
   - Output encoding and XSS prevention
   - SQL injection prevention
   - Sensitive data encryption
   - Data exposure in logs/errors

3. **Database Security**
   - Row Level Security (RLS) policies
   - Proper query parameterization
   - Access control verification
   - Audit trail implementation

4. **API Security**
   - Proper CORS configuration
   - Rate limiting implementation
   - Request validation
   - Response sanitization

## Threat Model
Consider threats specific to agricultural financial platform:
- Unauthorized access to farmer financial data
- Data manipulation attacks
- Privacy violations
- Regulatory compliance (GDPR, financial regulations)
- Rural network security considerations

## Expected Output
- **Critical Issues**: Immediate security vulnerabilities
- **High Priority**: Significant security improvements needed
- **Medium Priority**: Security enhancements recommended  
- **Low Priority**: Security best practice improvements
- **Compliance Gaps**: Regulatory requirement violations
- **Remediation Plan**: Step-by-step security improvements
```

---

## ⚡ **3. Performance Review**

### **Prompt: Performance Analysis**
```markdown
# PERFORMANCE REVIEW - {COMPONENT_NAME}

## Context
Analyze the performance impact of {COMPONENT_NAME} implementation in TelAgri Bank Dashboard, targeting 95+ Lighthouse score and optimal rural connectivity experience.

**Performance Targets:**
- Lighthouse Score: 95+ (Performance, Accessibility, Best Practices, SEO)
- Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- Bundle Size: Minimal impact on existing bundle
- Mobile Performance: Optimized for rural 3G connections

## Analysis Areas
1. **React Performance**
   - Component re-render optimization
   - Memoization usage (memo, useMemo, useCallback)
   - Key prop usage in lists
   - State management efficiency

2. **Bundle Impact**
   - Import analysis and tree shaking
   - Dynamic imports and code splitting
   - Dependency additions assessment
   - Bundle size comparison

3. **Database Performance**
   - Query efficiency and indexing
   - N+1 query prevention
   - Batch operations usage
   - Connection pool impact

4. **Network Optimization**
   - API call efficiency
   - Data fetching strategies
   - Caching implementation
   - Image and asset optimization

## Expected Output
- **Performance Metrics**: Before/after measurements
- **Bottleneck Identification**: Specific performance issues
- **Optimization Recommendations**: Actionable improvements
- **Code Changes**: Specific optimizations needed
- **Monitoring Strategy**: How to track performance ongoing
- **Mobile Impact**: Rural connectivity considerations
```

---

## 🧪 **4. Testing Review**

### **Prompt: Testing Coverage Analysis**
```markdown
# TESTING REVIEW - {FEATURE_NAME}

## Context
Evaluate the testing strategy and coverage for {FEATURE_NAME} against TelAgri's 70%+ coverage requirement and banking-grade quality standards.

**Current Tests:**
{DESCRIBE_EXISTING_TESTS_OR_PASTE_TEST_CODE}

## Testing Standards Review
1. **Coverage Analysis**
   - Unit test coverage percentage
   - Integration test coverage
   - E2E test coverage
   - Critical path coverage

2. **Test Quality**
   - Test case completeness
   - Edge case coverage
   - Error scenario testing
   - Mocking strategy effectiveness

3. **Testing Patterns**
   - Proper test structure (AAA pattern)
   - Test isolation and independence
   - Async testing patterns
   - Performance test coverage

## Critical Areas for Banking Platform
- Financial data accuracy testing
- Permission and security testing
- Error handling and recovery testing
- Data integrity and consistency testing
- Accessibility testing
- Performance regression testing

## Expected Output
- **Coverage Gaps**: Areas lacking sufficient tests
- **Test Quality Issues**: Tests that need improvement
- **Missing Test Types**: Unit, integration, or E2E gaps
- **Critical Path Coverage**: Essential workflow testing status
- **Test Recommendations**: Specific tests to add
- **Quality Improvements**: Test refactoring suggestions
- **Risk Assessment**: Untested areas and their business impact
```

---

## 🎨 **5. UI/UX Review**

### **Prompt: UI/UX Quality Review**
```markdown
# UI/UX REVIEW - {COMPONENT_NAME}

## Context
Review the UI/UX implementation of {COMPONENT_NAME} for TelAgri Bank Dashboard, focusing on rural user experience, accessibility, and design system compliance.

**UI to Review:**
{DESCRIBE_UI_OR_PROVIDE_SCREENSHOTS}

## Review Criteria
1. **Design System Compliance**
   - shadcn/ui component usage
   - Tailwind CSS pattern consistency
   - Typography and spacing standards
   - Color scheme adherence

2. **Accessibility (WCAG 2.1 AA)**
   - Semantic HTML structure
   - ARIA labels and descriptions
   - Keyboard navigation support
   - Screen reader compatibility
   - Color contrast ratios
   - Focus management

3. **Responsive Design**
   - Mobile-first implementation
   - Tablet and desktop layouts
   - Touch-friendly interactions
   - Rural connectivity optimization

4. **User Experience**
   - Information architecture
   - User flow and task completion
   - Error prevention and recovery
   - Loading states and feedback
   - Agricultural domain familiarity

## Rural User Considerations
- Low-bandwidth optimization
- Offline-first capabilities where applicable
- Simple, clear navigation for varying tech literacy
- Field-usage scenarios (outdoor, mobile)

## Expected Output
- **Accessibility Issues**: WCAG compliance gaps with priorities
- **Responsive Issues**: Mobile/tablet layout problems
- **Design System Violations**: Inconsistencies to fix
- **UX Improvements**: User experience enhancements
- **Performance Impact**: UI performance considerations
- **Rural Usability**: Specific farmer/field usage improvements
```

---

## 📊 **6. Database Review**

### **Prompt: Database Schema & Query Review**
```markdown
# DATABASE REVIEW - {FEATURE_NAME}

## Context
Review database schema changes and query implementations for {FEATURE_NAME} focusing on performance, security, and data integrity in TelAgri's financial platform.

**Database Changes:**
{PASTE_MIGRATION_SQL_OR_DESCRIBE_CHANGES}

**Queries to Review:**
{PASTE_QUERIES_OR_DESCRIBE_DATA_ACCESS_PATTERNS}

## Review Areas
1. **Schema Design**
   - Table structure and normalization
   - Index strategy and performance
   - Constraint and validation rules
   - Relationship integrity

2. **Security Implementation**
   - Row Level Security (RLS) policies
   - Access control verification
   - Data isolation between users/banks
   - Audit trail completeness

3. **Query Performance**
   - Query execution plan analysis
   - Index usage verification
   - N+1 query prevention
   - Batch operation efficiency

4. **Data Integrity**
   - Constraint enforcement
   - Transaction management
   - Rollback strategies
   - Data consistency rules

## Financial Platform Requirements
- Audit trail for all financial data access
- Data retention and compliance policies
- Multi-tenant data isolation (bank-specific data)
- Performance at scale (10,000+ farmers per bank)

## Expected Output
- **Security Issues**: RLS policy gaps and access control problems
- **Performance Issues**: Query optimization recommendations
- **Schema Issues**: Design improvements and constraint gaps
- **Index Recommendations**: Missing or inefficient indexes
- **Query Optimizations**: Specific query improvements
- **Compliance Gaps**: Audit and data integrity issues
- **Migration Safety**: Rollback and deployment considerations
```

---

## 🔄 **7. Architecture Review**

### **Prompt: Architecture & Patterns Review**
```markdown
# ARCHITECTURE REVIEW - {FEATURE_NAME}

## Context
Review the architectural decisions and implementation patterns for {FEATURE_NAME} in TelAgri Bank Dashboard, ensuring alignment with established patterns and scalability.

**Architecture to Review:**
{DESCRIBE_COMPONENT_ARCHITECTURE_OR_PASTE_CODE}

## Architecture Standards
1. **Component Architecture**
   - Compound component pattern usage
   - Component composition and reusability
   - Props interface design
   - State management strategy

2. **Data Flow**
   - Repository pattern implementation
   - Result pattern for error handling
   - TanStack Query integration
   - State management approach

3. **Error Handling**
   - Error boundary implementation
   - User-friendly error messages
   - Recovery strategies
   - Logging and monitoring

4. **Integration Patterns**
   - Supabase integration approach
   - Authentication/authorization flow
   - Permission-based rendering
   - Type safety implementation

## Scalability Considerations
- Component reusability across features
- Performance impact of architectural decisions
- Maintainability and team development efficiency
- Future extensibility and modification ease

## Expected Output
- **Pattern Violations**: Deviations from established patterns
- **Architecture Improvements**: Better structural approaches
- **Scalability Issues**: Components that won't scale well
- **Maintainability Concerns**: Hard-to-maintain code structures
- **Integration Issues**: Problems with existing system integration
- **Best Practice Recommendations**: Alignment with TelAgri standards
- **Refactoring Suggestions**: Specific architectural improvements
```

---

## 🎯 **Quick Review Checklist**

### **Prompt: Quick Quality Check**
```markdown
# QUICK REVIEW CHECKLIST - {COMPONENT_NAME}

## Context
Perform a quick quality check for {COMPONENT_NAME} before merge/deployment.

**Code to Check:**
{PASTE_CODE_OR_DESCRIBE_CHANGES}

## Quick Checklist
- [ ] **TypeScript**: No `any` types, proper interfaces
- [ ] **Security**: Input validation, no hardcoded secrets
- [ ] **Performance**: Proper memoization, efficient queries
- [ ] **Accessibility**: ARIA labels, semantic HTML
- [ ] **Error Handling**: Try/catch blocks, user-friendly errors
- [ ] **Testing**: Test files updated, critical paths covered
- [ ] **Documentation**: Comments for complex logic
- [ ] **Patterns**: Follows TelAgri established patterns

## Red Flags to Look For
- Exposed sensitive data (API keys, tokens, personal info)
- SQL injection vulnerabilities
- XSS vulnerabilities
- Performance anti-patterns
- Accessibility violations
- Missing error handling

## Expected Output
- **Pass/Fail**: Ready for merge or needs work
- **Critical Issues**: Must-fix items before deployment
- **Recommendations**: Nice-to-have improvements
```

---

**💡 Usage Tips:**
- Use specific prompts based on review focus area
- Combine prompts for comprehensive reviews
- Customize variables with actual component/feature names
- Save successful prompt variations for team use 