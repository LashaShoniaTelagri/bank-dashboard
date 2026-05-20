#!/usr/bin/env node
// Standalone CDK app for the ALE R parity service.
// Kept SEPARATE from bin/telagri-app.ts so the main deploy.yml pipeline never
// touches it — parity is provisioned via the dedicated, manually-triggered
// workflow .github/workflows/r-parity-deploy.yml.
//
// See specs/decisions.md § ADR 0013, gis-scripts/parity-service/README.md.

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RParityStack } from '../lib/r-parity-stack';

const app = new cdk.App();

const awsAccount = process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT;
// us-east-1 is locked per ADR 0013 — keep this hard rather than env-driven.
const awsRegion = 'us-east-1';

if (!awsAccount) {
  throw new Error('AWS_ACCOUNT_ID environment variable is required');
}

const keyName = process.env.SSH_KEY_NAME ?? '';      // optional — empty disables SSH ingress
const sshAllowCidr = process.env.SSH_ALLOW_CIDR;     // e.g. "1.2.3.4/32" — optional

console.log('🧪 Deploying ALE R parity stack');
console.log(`🏗️  Account: ${awsAccount}`);
console.log(`🌍 Region:  ${awsRegion}`);
console.log(`🔑 SSH key: ${keyName || '(none — use SSM Session Manager)'}`);
console.log(`🌐 SSH CIDR: ${sshAllowCidr ?? '(closed)'}`);

new RParityStack(app, 'TelAgri-ALE-R-Parity', {
  keyName,
  sshAllowCidr,
  env: {
    account: awsAccount,
    region: awsRegion,
  },
  // CloudFormation stack description must be ASCII-only.
  description: 'ALE R parity service - temporary infra; tear down after TS-port sign-off',
});

app.synth();
