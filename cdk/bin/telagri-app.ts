#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TelAgriStack } from '../lib/telagri-stack';

const app = new cdk.App();

// Environment configuration
const environment = process.env.ENVIRONMENT || 'dev';
const awsAccount = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Required environment variables for custom domain
const domainName = process.env.DOMAIN_NAME;
const certificateArn = process.env.CERTIFICATE_ARN;

// Optional variables (not used since we skip Route53 automation)
const hostedZoneId = process.env.HOSTED_ZONE_ID || 'Z123456789';
const crossAccountRoleArn = process.env.CROSS_ACCOUNT_ROLE_ARN || 'arn:aws:iam::987654321098:role/test';
const rootAccountId = process.env.ROOT_ACCOUNT_ID || '987654321098';

if (!domainName) {
  throw new Error('DOMAIN_NAME environment variable is required');
}
if (!certificateArn) {
  throw new Error('CERTIFICATE_ARN environment variable is required');
}
if (!awsAccount) {
  throw new Error('AWS_ACCOUNT_ID environment variable is required');
}

console.log(`🌾 Deploying TelAgri Bank Dashboard - ${environment.toUpperCase()}`);
console.log(`📍 Domain: ${domainName}`);
console.log(`🏗️  Account: ${awsAccount}`);
console.log(`🌍 Region: ${awsRegion}`);

new TelAgriStack(app, `TelAgri-Bank-Dashboard-${environment}`, {
  domainName,
  hostedZoneId,
  certificateArn,
  crossAccountRoleArn,
  rootAccountId,
  environment: environment as 'dev' | 'staging' | 'prod',
  env: {
    account: awsAccount,
    region: awsRegion,
  },
  description: `TelAgri Bank Dashboard PWA - ${environment} environment`,
});

// Synthesis validation
app.synth(); 