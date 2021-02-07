import { APIGatewayProxyHandler } from "aws-lambda";
import { AxiosError } from "axios";
import { isEmpty } from "lodash";
import "source-map-support/register";
import downloadIpRangeList, { ipRangesToRules, RuleList } from "./ip-ranges";
import updateSecurityGroups from "./security-groups";

export const main: APIGatewayProxyHandler = async (event, _context) => {
  try {
    const snsMessage: Record<string, any> = JSON.parse(
      (event as any).Records[0].Sns.Message
    );

    if (!process.env.SECURITY_GROUP_IDS) {
      throw new Error("Security group IDs are not specified");
    }
    const securityGroupIds: string[] = JSON.parse(
      process.env.SECURITY_GROUP_IDS
    );
    if (isEmpty(securityGroupIds)) {
      throw new Error(
        "Security group ID list is empty, at least one security group has to be specified"
      );
    }

    const servicePorts: number[] = JSON.parse(
      process.env.SERVICE_PORTS || "[]"
    );

    const rules: RuleList = ipRangesToRules(
      await downloadIpRangeList(
        snsMessage.url,
        snsMessage.md5,
        process.env.AWS_SERVICE_FILTER
      ),
      servicePorts
    );
    await updateSecurityGroups(securityGroupIds, rules);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "success" }, null, 2),
    };
  } catch (error) {
    if ((error as AxiosError).isAxiosError !== undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify(error.toJSON(), null, 2),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: error.message }, null, 2),
      };
    }
  }
};
