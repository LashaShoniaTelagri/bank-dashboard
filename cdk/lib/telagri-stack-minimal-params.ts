// OPTIONAL: Minimal Parameter Store approach
// Remove these lines from CDK if you want scripts to handle everything:

// REMOVE: Frontend Environment Parameter creation
// const frontendParameter = new ssm.StringParameter(this, 'FrontendEnvironmentParameter', {
//   parameterName: `/telagri/monitoring/${environment}/frontend/env`,
//   description: `Frontend environment configuration for ${environment}`,
//   stringValue: this.getFrontendEnvironmentTemplate(environment),
//   type: ssm.ParameterType.STRING,
// });

// REMOVE: Backend Environment Parameter creation  
// const backendParameter = new ssm.StringParameter(this, 'BackendEnvironmentParameter', {
//   parameterName: `/telagri/monitoring/${environment}/backend/env`,
//   description: `Backend environment configuration for ${environment}`,
//   stringValue: this.getBackendEnvironmentTemplate(environment),
//   type: ssm.ParameterType.STRING,
// });

// REMOVE: Template methods
// private getFrontendEnvironmentTemplate(environment: string): string { ... }
// private getBackendEnvironmentTemplate(environment: string): string { ... }

// KEEP: KMS Key (essential for encryption)
// KEEP: IAM Permissions (essential for GitHub Actions)
// KEEP: KMS Alias (useful for reference)
