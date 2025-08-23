# 🚀 Feature Development Prompts

**Systematic prompts for creating new features in TelAgri Bank Dashboard**

---

## 📋 **1. Feature Planning & Analysis**

### **Prompt: Feature Requirements Analysis**
```markdown
# FEATURE PLANNING - {FEATURE_NAME}

## Context
I'm working on the TelAgri Bank Dashboard, an AgriTech financial platform for managing farmer loans, F-100 reports, and bank partnerships. This is a production-grade application with banking-grade security requirements.

**Current Tech Stack:**
- Frontend: React 19 + TypeScript 5.8+ + Vite + shadcn/ui + Tailwind CSS
- Package Manager: Bun 1.x
- Backend: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Deployment: AWS CDK + GitHub Actions
- Security: 2FA, RLS, JWT tokens, rate limiting, trusted devices

## Feature Request
{DETAILED_FEATURE_DESCRIPTION}

## Requirements Analysis Needed
1. **User Stories**: Break down into specific user stories with acceptance criteria
2. **Database Schema**: What tables/columns are needed? What relationships?
3. **Security Considerations**: What permissions, validation, and security measures?
4. **UI/UX Components**: What components need to be created or modified?
5. **API Design**: What Supabase queries, Edge Functions, or RPC calls are needed?
6. **Testing Strategy**: What unit, integration, and E2E tests are required?
7. **Performance Impact**: How does this affect page load, bundle size, database queries?
8. **Migration Plan**: What database migrations are needed?

## Constraints
- Must maintain banking-grade security
- Must work with existing authentication/authorization system
- Must follow React 19 patterns and TypeScript best practices
- Must be mobile-responsive and accessible (WCAG 2.1 AA)
- Must integrate with existing Supabase schema and RLS policies
- Target: 95+ Lighthouse score

## Expected Output
- Structured analysis with technical implementation details
- Database schema changes with migration SQL
- Component architecture breakdown
- Security implementation plan
- Testing approach with specific test cases
- Performance considerations and optimizations
- Step-by-step implementation roadmap

## Business Context
This feature will be used by {TARGET_USER_ROLES} to {BUSINESS_VALUE_DESCRIPTION} in the context of agricultural financing and farmer loan management.
```

---

## 🏗️ **2. Technical Architecture Design**

### **Prompt: Component Architecture Planning**
```markdown
# COMPONENT ARCHITECTURE - {FEATURE_NAME}

## Context
Based on the feature analysis for {FEATURE_NAME}, I need to design the React component architecture following TelAgri's established patterns.

**Existing Component Patterns:**
- Compound components for complex UI
- Repository pattern for data access
- Result pattern for error handling
- Permission-based HOCs for authorization
- TanStack Query for server state management

## Architecture Requirements
1. **Component Hierarchy**: Design the component tree structure
2. **State Management**: Identify what needs local state, server state, or global state
3. **Data Flow**: Map out props, callbacks, and data dependencies
4. **Reusability**: Identify reusable components vs feature-specific ones
5. **Performance**: Plan for memoization, lazy loading, and optimization
6. **Error Boundaries**: Define error handling and fallback strategies
7. **Testing Strategy**: Plan component testing approach

## Design Constraints
- Follow compound component pattern for complex features
- Use TypeScript strict mode with proper interfaces
- Implement proper error boundaries and loading states
- Ensure accessibility (ARIA labels, semantic HTML, keyboard navigation)
- Follow shadcn/ui design system and Tailwind CSS patterns
- Mobile-first responsive design

## Expected Output
- Visual component hierarchy diagram (ASCII or description)
- TypeScript interfaces for props and state
- Component file structure and naming
- Data flow architecture
- State management strategy
- Performance optimization plan
- Error handling approach
```

---

## 💾 **3. Database Schema Design**

### **Prompt: Database Schema & Migrations**
```markdown
# DATABASE SCHEMA - {FEATURE_NAME}

## Context
I need to design database schema changes for the {FEATURE_NAME} feature in the TelAgri Bank Dashboard.

**Existing Core Tables:**
- profiles (user profiles with roles)
- banks (bank information and partnerships)
- farmers (farmer data and loan information)
- f100 (F-100 financial reports)
- invitations (bank user invitation system)
- two_factor_codes (2FA verification codes)
- trusted_devices (device trust for 2FA)

## Schema Requirements
1. **New Tables**: What new tables are needed with full column definitions?
2. **Table Relationships**: Foreign keys, constraints, and relationships
3. **Indexes**: Performance indexes for expected query patterns
4. **RLS Policies**: Row Level Security policies for data isolation
5. **Audit Fields**: created_at, updated_at, created_by tracking
6. **Data Validation**: Check constraints and data integrity rules
7. **Migration Strategy**: Safe migration with rollback plan

## Security Requirements
- All tables must have appropriate RLS policies
- User data must be isolated by permissions (Administrator, BankViewer, ReadOnly)
- Sensitive data must be properly encrypted/protected
- Audit trails for financial data access
- No direct access without proper authentication

## Expected Output
- Complete SQL migration file with proper naming convention
- CREATE TABLE statements with all constraints
- RLS policy definitions with security rules
- Index creation for performance optimization
- Helper functions if needed (RPC functions)
- Rollback migration for safe reversion
- Documentation of schema decisions and trade-offs

## Performance Considerations
- Query performance for expected access patterns
- Index strategy for search and filtering
- Data archiving strategy if applicable
- Connection pool impact assessment
```

---

## 🎨 **4. UI/UX Implementation**

### **Prompt: UI Component Implementation**
```markdown
# UI IMPLEMENTATION - {COMPONENT_NAME}

## Context
I need to implement the {COMPONENT_NAME} component for the {FEATURE_NAME} feature in TelAgri Bank Dashboard.

**Design System:**
- shadcn/ui component library as base
- Tailwind CSS for styling
- Mobile-first responsive design
- WCAG 2.1 AA accessibility compliance
- Consistent spacing and typography

## Component Requirements
1. **Visual Design**: Implement the designed interface with proper styling
2. **Interactions**: Handle user interactions and state changes
3. **Validation**: Form validation with proper error messages
4. **Loading States**: Proper loading indicators and skeleton states
5. **Error Handling**: User-friendly error messages and recovery
6. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
7. **Responsiveness**: Mobile, tablet, and desktop layouts

## Technical Requirements
- Use React 19 features where appropriate (use() hook, Actions, etc.)
- Implement proper TypeScript interfaces
- Follow compound component pattern if complex
- Use React Hook Form + Zod for form validation
- Implement proper memoization for performance
- Add proper data-testid attributes for testing

## Expected Output
- Complete React component with TypeScript
- Proper shadcn/ui integration and Tailwind CSS styling
- Form validation schemas (Zod) if applicable
- Accessibility implementation (ARIA, semantic HTML)
- Mobile-responsive design
- Loading and error state handling
- Component documentation and usage examples

## Integration Requirements
- Integrate with TanStack Query for data fetching
- Connect to Supabase repository functions
- Implement proper error boundaries
- Follow existing authentication/authorization patterns
```

---

## 🔧 **5. Backend Integration**

### **Prompt: Supabase Integration & Edge Functions**
```markdown
# BACKEND INTEGRATION - {FEATURE_NAME}

## Context
I need to implement the backend integration for {FEATURE_NAME} including Supabase queries, Edge Functions, and data repository patterns.

**Backend Architecture:**
- Supabase PostgreSQL with Row Level Security (RLS)
- Edge Functions for complex business logic
- Repository pattern for data access abstraction
- Result pattern for error handling

## Integration Requirements
1. **Repository Functions**: Type-safe database access functions
2. **Edge Functions**: Business logic that needs server-side execution
3. **RLS Verification**: Ensure proper data access permissions
4. **Error Handling**: Comprehensive error handling with user-friendly messages
5. **Performance**: Efficient queries with proper indexing
6. **Type Safety**: Full TypeScript integration with Supabase types
7. **Testing**: Unit tests for repository functions and Edge Functions

## Security Requirements
- All database access must respect RLS policies
- Input validation and sanitization
- Proper authentication verification
- Rate limiting for sensitive operations
- Audit logging for financial data access

## Expected Output
- Repository class with typed methods
- Edge Function implementation if needed
- Supabase query optimization
- Error handling with Result pattern
- Type definitions for all data structures
- Unit tests for backend functions
- Integration documentation

## Performance Considerations
- Query optimization and explain plans
- Batch operations where applicable
- Connection pooling considerations
- Caching strategy if needed
```

---

## 🧪 **6. Testing Implementation**

### **Prompt: Comprehensive Testing Strategy**
```markdown
# TESTING STRATEGY - {FEATURE_NAME}

## Context
I need to implement comprehensive testing for the {FEATURE_NAME} feature following TelAgri's testing standards (70%+ coverage requirement).

**Testing Stack:**
- Unit Tests: Jest + React Testing Library
- Integration Tests: API and database testing
- E2E Tests: Playwright for user workflows
- Component Tests: Testing user interactions

## Testing Requirements
1. **Unit Tests**: Component logic, utility functions, repository methods
2. **Integration Tests**: API endpoints, database operations, authentication flows
3. **E2E Tests**: Complete user workflows and business scenarios
4. **Accessibility Tests**: Screen reader compatibility and keyboard navigation
5. **Performance Tests**: Component rendering performance and bundle size
6. **Security Tests**: Permission validation and data access controls

## Test Coverage Areas
- Happy path scenarios with valid data
- Error scenarios and edge cases
- Permission-based access control
- Form validation and error messages
- Loading states and async operations
- Responsive design across devices
- Accessibility compliance

## Expected Output
- Unit test suite with comprehensive component testing
- Integration tests for backend operations
- E2E test scenarios for user workflows
- Mock implementations for external dependencies
- Test utilities and shared fixtures
- Performance benchmarks and thresholds
- Documentation of testing approach

## Quality Standards
- 70%+ code coverage minimum
- All critical paths must be tested
- Error scenarios must have test coverage
- Accessibility testing included
- Performance regression prevention
```

---

## 📚 **7. Documentation & Review**

### **Prompt: Feature Documentation**
```markdown
# DOCUMENTATION - {FEATURE_NAME}

## Context
I need to create comprehensive documentation for the completed {FEATURE_NAME} feature in TelAgri Bank Dashboard.

## Documentation Requirements
1. **Feature Overview**: What the feature does and why it exists
2. **User Guide**: How to use the feature (with screenshots if needed)
3. **Technical Architecture**: How the feature is implemented
4. **API Documentation**: Backend endpoints and data structures
5. **Security Considerations**: Permission requirements and data access
6. **Testing Documentation**: How to test the feature
7. **Troubleshooting**: Common issues and solutions

## Documentation Structure
- Add to appropriate docs/ folder (features/, development/, etc.)
- Update main documentation index
- Cross-reference related documentation
- Include code examples and usage patterns
- Add troubleshooting section

## Expected Output
- Comprehensive feature documentation file
- Updated documentation index
- Code examples and usage patterns
- Troubleshooting guide
- Links to related documentation
- Screenshots or diagrams if helpful

## Maintenance Requirements
- Document how to maintain and extend the feature
- Note any regular maintenance tasks
- Identify monitoring and alerting needs
- Plan for future enhancements
```

---

## 🔄 **Workflow Example**

### **Complete Feature Development Process**
```
1. Use "Feature Requirements Analysis" prompt
   ↓
2. Use "Component Architecture Planning" prompt  
   ↓
3. Use "Database Schema & Migrations" prompt
   ↓
4. Use "UI Component Implementation" prompt
   ↓
5. Use "Backend Integration" prompt
   ↓
6. Use "Testing Strategy" prompt
   ↓
7. Use "Feature Documentation" prompt
   ↓
8. Code review and deployment
```

---

**💡 Pro Tips:**
- Start with planning prompts before implementation
- Customize all `{VARIABLES}` with specific details
- Save successful prompt variations for reuse
- Combine prompts for complex features
- Always include security and performance considerations 