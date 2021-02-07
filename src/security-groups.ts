import { EC2 } from "aws-sdk";
import {
  differenceWith,
  forEach,
  groupBy,
  isEmpty,
  keys,
  map,
  pullAll,
  pullAllWith,
  size,
  slice,
} from "lodash";
import { Rule, RuleList } from "./ip-ranges";

const ec2 = new EC2({
  ...(process.env.FORCE_AWS_REGION && { region: process.env.FORCE_AWS_REGION }),
});

const _addNewRules = async (
  securityGroupIds: string[],
  existingRules: RuleList,
  newRules: RuleList
) => {
  const maxRulesPerGroup = 60;

  console.log(`Adding ${size(newRules)} rules`);

  const rulesByGroup = groupBy(existingRules, "GroupId");
  for (const securityGroupId of securityGroupIds) {
    if (isEmpty(newRules)) {
      break;
    }

    const availableRulesCount =
      maxRulesPerGroup - size(rulesByGroup[securityGroupId]);
    if (availableRulesCount <= 0) {
      continue;
    }

    const rulesToAdd = slice(newRules, 0, availableRulesCount);
    await ec2
      .authorizeSecurityGroupIngress({
        GroupId: securityGroupId,
        IpPermissions: map(
          rulesToAdd,
          (rule: Rule): EC2.IpPermission => ({
            FromPort: rule.FromPort,
            IpProtocol: rule.IpProtocol,
            IpRanges: [{ CidrIp: rule.IpRange }],
            ToPort: rule.ToPort,
          })
        ),
      })
      .promise();

    pullAll(newRules, rulesToAdd);
  }

  if (!isEmpty(newRules)) {
    const rulesLeft: number = size(newRules);
    const groupsNeeded =
      ~~(rulesLeft / maxRulesPerGroup) +
      (rulesLeft % maxRulesPerGroup > 0 ? 1 : 0);
    console.warn(
      `Not enough security group IDs provided, ${rulesLeft} rules not added, need at least ${groupsNeeded} more security groups`
    );
  }
};

const _discardExistingRules = (existingRules: RuleList, newRules: RuleList) =>
  pullAllWith(
    newRules,
    existingRules,
    (arrVal: Rule, othVal: Rule) =>
      arrVal.FromPort === othVal.FromPort &&
      arrVal.IpProtocol === othVal.IpProtocol &&
      arrVal.IpRange === othVal.IpRange &&
      arrVal.ToPort === othVal.ToPort
  );

const _getExistingRules = async (
  securityGroupIds: string[]
): Promise<RuleList> => {
  let result: RuleList = [];

  for (const securityGroupId of securityGroupIds) {
    const permissions = (
      await ec2
        .describeSecurityGroups({ GroupIds: [securityGroupId] })
        .promise()
    ).SecurityGroups[0].IpPermissions;

    forEach(permissions, (permission: EC2.IpPermission) => {
      forEach(permission.IpRanges, (range: EC2.IpRange) => {
        result.push({
          FromPort: permission.FromPort,
          GroupId: securityGroupId,
          IpProtocol: permission.IpProtocol,
          IpRange: range.CidrIp,
          ToPort: permission.ToPort,
        });
      });
    });
  }

  return result;
};

const _revokeOutdatedRules = async (
  existingRules: RuleList,
  newRules: RuleList
): Promise<void> => {
  const rulesToRevoke: RuleList = differenceWith(
    existingRules,
    newRules,
    (arrVal: Rule, othVal: Rule) =>
      arrVal.FromPort === othVal.FromPort &&
      arrVal.IpProtocol === othVal.IpProtocol &&
      arrVal.IpRange === othVal.IpRange &&
      arrVal.ToPort === othVal.ToPort
  );
  if (isEmpty(rulesToRevoke)) {
    return;
  }

  console.log(`Revoking ${size(rulesToRevoke)} rules`);
  const rulesByGroup = groupBy(rulesToRevoke, "GroupId");
  for (const securityGroupId of keys(rulesByGroup)) {
    await ec2
      .revokeSecurityGroupIngress({
        GroupId: securityGroupId,
        IpPermissions: map(
          rulesByGroup[securityGroupId],
          (rule: Rule): EC2.IpPermission => ({
            FromPort: rule.FromPort,
            IpProtocol: rule.IpProtocol,
            IpRanges: [{ CidrIp: rule.IpRange }],
            ToPort: rule.ToPort,
          })
        ),
      })
      .promise();
  }

  pullAll(existingRules, rulesToRevoke);
};

const updateSecurityGroups = async (
  securityGroupIds: string[],
  newRules: RuleList
): Promise<void> => {
  const existingRules = await _getExistingRules(securityGroupIds);
  await _revokeOutdatedRules(existingRules, newRules);
  _discardExistingRules(existingRules, newRules);
  await _addNewRules(securityGroupIds, existingRules, newRules);
};

export default updateSecurityGroups;
