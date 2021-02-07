import axios from "axios";
import { createHash } from "crypto";
import { filter, forEach, map } from "lodash";

export type IpRange = string;
export type IpRangeList = IpRange[];
export type Rule = {
  FromPort: number;
  GroupId?: string;
  IpProtocol: string;
  IpRange: string;
  ToPort: number;
};
export type RuleList = Rule[];

const _filterIpRangeList = (
  ranges: Record<string, any>[],
  serviceFilter: string
): IpRange[] => {
  const result = map(
    filter(ranges, (range) =>
      serviceFilter ? range.service === serviceFilter : true
    ),
    (range) => range.ip_prefix
  );
  console.log(
    `Filtered IP range count ${result.length}, filter ${
      process.env.AWS_SERVICE_FILTER
        ? process.env.AWS_SERVICE_FILTER
        : "not specified"
    }`
  );

  return result;
};

const downloadIpRangeList = async (
  url: string,
  expectedHash: string,
  serviceFilter: string
): Promise<IpRangeList> => {
  console.log(`Downloading IP range list from ${url}`);
  const result = await axios.get(url, { transformResponse: (res) => res });

  const hash = createHash("md5").update(result.data).digest("hex");
  if (hash != expectedHash) {
    throw new Error(
      `File MD5 hash mismatch, got ${hash}, expected ${expectedHash}`
    );
  }

  const parsed = JSON.parse(result.data);
  console.log(`Total IP range count ${parsed.prefixes.length}`);
  return _filterIpRangeList(parsed.prefixes, serviceFilter);
};

export const ipRangesToRules = (
  ranges: IpRangeList,
  servicePorts: number[]
): RuleList => {
  let result: RuleList = [];

  forEach(servicePorts, (servicePort: number) => {
    forEach(ranges, (range: string) => {
      result.push({
        FromPort: servicePort,
        IpProtocol: "tcp",
        IpRange: range,
        ToPort: servicePort,
      });
    });
  });

  return result;
};

export default downloadIpRangeList;
