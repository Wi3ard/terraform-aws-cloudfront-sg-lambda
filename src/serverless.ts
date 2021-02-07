import type { AWS } from "@serverless/typescript";

const serverlessConfiguration: AWS = {
  service: "cloudfront-sg-lambda",
  frameworkVersion: "2",
  custom: {
    webpack: {
      webpackConfig: "./webpack.config.js",
      includeModules: true,
    },
  },
  plugins: ["serverless-offline", "serverless-webpack"],
  provider: {
    name: "aws",
    runtime: "nodejs12.x",
    lambdaHashingVersion: "20201221",
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
    },
  },
  functions: {
    main: {
      handler: "handler.main",
      events: [
        {
          http: {
            method: "get",
            path: "main",
          },
        },
      ],
    },
  },
  useDotenv: true,
};

module.exports = serverlessConfiguration;
