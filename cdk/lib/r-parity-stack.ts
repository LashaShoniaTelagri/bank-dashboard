// EC2 + EIP + Security Group for the ALE R parity service.
// DNS (algo.telagri.com → EIP) is managed manually by ops, NOT by this stack.
// See specs/decisions.md § 0013, gis-scripts/scripts/frost-risk/parity-service/README.md.

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface RParityStackProps extends cdk.StackProps {
  /**
   * Optional SSH key pair NAME (must already exist in this region).
   * Leave empty to skip key-based SSH; use AWS SSM Session Manager instead
   * (the IAM role wired below grants that).
   */
  keyName?: string;
  /** Optional CIDR allowed to SSH. Defaults to nothing — close 22 by default. */
  sshAllowCidr?: string;
}

export class RParityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RParityStackProps) {
    super(scope, id, props);

    // VPC: use the default VPC to keep things lean. Parity is temporary infra.
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // Security group: 80/443 open to the world (TLS via Let's Encrypt + HMAC auth).
    // 22 closed by default — pass sshAllowCidr to open it.
    const sg = new ec2.SecurityGroup(this, 'RParitySg', {
      vpc,
      // EC2 SG descriptions are ASCII-only (no em-dash, no unicode).
      description: 'ALE R parity service - HTTP/HTTPS public; SSH locked unless explicitly opened.',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP (ACME challenge + redirect)');
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    if (props.sshAllowCidr) {
      sg.addIngressRule(ec2.Peer.ipv4(props.sshAllowCidr), ec2.Port.tcp(22), 'SSH (restricted)');
    }

    // Minimal IAM role — instance writes its own logs, nothing else.
    const role = new iam.Role(this, 'RParityRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Ubuntu 24.04 LTS ARM64. Look up via SSM parameter so we always get latest.
    const ami = ec2.MachineImage.fromSsmParameter(
      '/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id',
      { os: ec2.OperatingSystemType.LINUX },
    );

    const instance = new ec2.Instance(this, 'RParityHost', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ami,
      securityGroup: sg,
      role,
      // SSH key is optional — without it, use SSM Session Manager.
      keyPair: props.keyName
        ? ec2.KeyPair.fromKeyPairName(this, 'KeyPair', props.keyName)
        : undefined,
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3 }),
      }],
    });

    // Static IP. User points algo.telagri.com → this EIP manually.
    const eip = new ec2.CfnEIP(this, 'RParityEip', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: 'ale-r-parity' }],
    });
    new ec2.CfnEIPAssociation(this, 'RParityEipAssoc', {
      eip: eip.ref,
      instanceId: instance.instanceId,
    });

    // Tag everything so the temp nature is obvious.
    cdk.Tags.of(this).add('app', 'telagri-ale-parity');
    cdk.Tags.of(this).add('lifecycle', 'parity-temporary');

    new cdk.CfnOutput(this, 'PublicIp', {
      value: eip.attrPublicIp,
      description: 'Point algo.telagri.com A-record at this IP.',
    });
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'SSH via SSM Session Manager (no SSH key needed): aws ssm start-session --target <id>',
    });
  }
}
