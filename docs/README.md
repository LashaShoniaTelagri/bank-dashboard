# 📚 TelAgri Bank Dashboard Documentation

**Comprehensive documentation for the AgriTech financial platform for farmer loan management.**

---

## 📖 **Quick Start**
- [Main README](../README.md) - Project overview and quick start guide
- [Setup Guide](setup/GITHUB_SETUP.md) - Initial project setup
- [Supabase Setup](setup/SUPABASE_MIGRATIONS_SETUP.md) - Database and backend configuration

---

## 🏗️ **Setup & Configuration**
| Document | Description | Last Updated |
|----------|-------------|--------------|
| [GitHub Setup](setup/GITHUB_SETUP.md) | Repository configuration, secrets, and CI/CD setup | Current |
| [Supabase Migrations](setup/SUPABASE_MIGRATIONS_SETUP.md) | Database setup and migration workflows | Current |

---

## 🚀 **Deployment**
| Document | Description | Last Updated |
|----------|-------------|--------------|
| [AWS Deployment Guide](deployment/AWS_DEPLOYMENT_GUIDE.md) | Complete AWS infrastructure deployment | Current |
| [Deployment Summary](deployment/DEPLOYMENT_SUMMARY.md) | Quick deployment overview and troubleshooting | Current |

---

## ⭐ **Features**
| Document | Description | Last Updated |
|----------|-------------|--------------|
| [2FA Trusted Devices](features/2FA_TRUSTED_DEVICES_GUIDE.md) | 30-day trusted device authentication | Current |
| [Progressive Web App](features/PWA_GUIDE.md) | PWA implementation and installation | Current |

---

## 🔧 **Development**
| Document | Description | Last Updated |
|----------|-------------|--------------|
| [Bun Migration Guide](development/BUN_MIGRATION_GUIDE.md) | Migration from npm to Bun package manager | Current |
| [Project Prompts](development/PROJECT_PROMPT.md) | Development context and prompts | Current |
| [Cursor Rules](../.cursorrules) | AI assistant development guidelines | Current |

---

## 🎯 **Prompt Management**
| Document | Description | Last Updated |
|----------|-------------|--------------|
| [Prompt Library](prompts/README.md) | Reusable development prompts | Current |
| [Feature Development Prompts](prompts/feature-development.md) | Systematic feature creation workflows | Current |
| [Code Review Prompts](prompts/code-review.md) | Quality assurance and review prompts | Current |

---

## 📋 **Documentation Standards**

### **File Organization**
```
docs/
├── setup/           # Initial project configuration
├── deployment/      # Infrastructure and deployment guides  
├── features/        # Feature-specific documentation
├── development/     # Development workflows and guides
├── prompts/         # Prompt management and templates
└── README.md        # This index file
```

### **Documentation Guidelines**
- **Keep Current**: Update docs when features change
- **Be Specific**: Include concrete examples and code snippets
- **Link Relationships**: Cross-reference related documentation
- **Version Changes**: Note when documentation was last updated
- **User-Focused**: Write for different audience levels (developers, ops, business)

---

## 🔍 **Search & Navigation**
- Use `Cmd+F` / `Ctrl+F` to search within documents
- Follow internal links for related topics
- Check the [Cursor Rules](../.cursorrules) for development patterns
- Reference [Main README](../README.md) for architecture overview

---

**💡 Tip**: When adding new features, always update relevant documentation and add appropriate prompts to the [Prompt Library](prompts/README.md). 