# 🎯 Prompt Library - TelAgri Bank Dashboard

**Systematic prompt management for AI-assisted development workflows**

---

## 📋 **Quick Reference**

| Prompt Category | File | Use Case |
|-----------------|------|----------|
| 🚀 **Feature Development** | [feature-development.md](feature-development.md) | Creating new features systematically |
| 🔍 **Code Review** | [code-review.md](code-review.md) | Quality assurance and code analysis |
| 🐛 **Debugging** | [debugging.md](debugging.md) | Troubleshooting and error resolution |
| 📊 **Database Operations** | [database.md](database.md) | Schema changes, migrations, queries |
| 🔐 **Security** | [security.md](security.md) | Security analysis and implementation |
| 📱 **UI/UX** | [ui-ux.md](ui-ux.md) | Interface design and user experience |
| 🚀 **Deployment** | [deployment.md](deployment.md) | Infrastructure and deployment tasks |
| 📚 **Documentation** | [documentation.md](documentation.md) | Documentation creation and updates |

---

## 🎨 **How to Use Prompts**

### **In Cursor IDE**
1. **Copy prompt template** from the appropriate file
2. **Customize variables** (replace placeholders like `{FEATURE_NAME}`)
3. **Paste in Cursor Chat** or use as context
4. **Iterate and refine** based on results

### **Prompt Template Format**
```markdown
# {CATEGORY} - {SPECIFIC_TASK}

## Context
{Background information about the task}

## Requirements
- {Specific requirement 1}
- {Specific requirement 2}

## Constraints
- {Technical constraints}
- {Business constraints}

## Expected Output
- {What you expect to receive}

## Examples
{Concrete examples if applicable}
```

---

## 🔄 **Workflow Patterns**

### **Feature Development Workflow**
```
1. Planning Prompt → 2. Architecture Prompt → 3. Implementation Prompt → 
4. Testing Prompt → 5. Documentation Prompt → 6. Review Prompt
```

### **Bug Fix Workflow**  
```
1. Debugging Prompt → 2. Root Cause Analysis → 3. Solution Design → 
4. Implementation → 5. Testing → 6. Documentation Update
```

### **Refactoring Workflow**
```
1. Analysis Prompt → 2. Architecture Review → 3. Migration Plan → 
4. Step-by-step Implementation → 5. Testing → 6. Performance Validation
```

---

## 📝 **Prompt Customization Guidelines**

### **Variables to Replace**
- `{PROJECT_NAME}` → "TelAgri Bank Dashboard"
- `{FEATURE_NAME}` → Specific feature being developed
- `{COMPONENT_NAME}` → React component name
- `{TABLE_NAME}` → Database table name
- `{USER_ROLE}` → "Administrator", "BankViewer", etc.
- `{TECH_STACK}` → "React 19 + TypeScript + Supabase + Bun"

### **Context Enhancement**
Always include relevant context:
- **Domain**: AgriTech financial platform for farmers
- **Security Level**: Banking-grade security requirements  
- **Performance**: Target 95+ Lighthouse score
- **Architecture**: React 19, TypeScript 5.8+, Bun, Supabase

---

## 💡 **Best Practices**

### **Effective Prompting**
- ✅ **Be Specific**: Include concrete examples and requirements
- ✅ **Provide Context**: Reference existing code and patterns
- ✅ **Set Constraints**: Define technical and business limitations
- ✅ **Request Structure**: Ask for organized, implementable responses
- ✅ **Include Testing**: Always request test considerations

### **Prompt Maintenance**
- 🔄 **Update Regularly**: Keep prompts current with tech stack changes
- 📝 **Document Variations**: Note successful prompt modifications
- 🧪 **Test Effectiveness**: Track which prompts produce best results
- 🔗 **Cross-Reference**: Link related prompts and documentation

---

## 🚀 **Creating New Prompts**

When adding new prompt templates:

1. **Follow Naming Convention**: `{category}-{specific-task}.md`
2. **Use Standard Template**: Include Context, Requirements, Constraints, Output
3. **Add to Index**: Update this README with new prompt reference
4. **Test Thoroughly**: Validate prompt effectiveness before committing
5. **Document Variations**: Note different use cases or modifications

---

## 📊 **Prompt Performance Tracking**

Keep track of:
- **Most Effective Prompts**: Which ones consistently produce quality results
- **Common Customizations**: Frequently used prompt modifications
- **Context Patterns**: What context information is most valuable
- **Output Quality**: Which prompts need refinement

---

**🎯 Next Steps**: 
1. Choose appropriate prompt for your task
2. Customize variables and context
3. Use in Cursor Chat for AI assistance
4. Document successful variations for team use

---

**💡 Pro Tip**: Combine prompts for complex workflows. Start with a planning prompt, then move to implementation prompts for each component. 