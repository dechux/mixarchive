import {
  spawnSync
} from "node:child_process";

const CHECKS = [
  {
    name:
      "ArchiveQueryService smoke test",

    command: [
      "scripts/test-archive-query-service.js"
    ]
  },

  {
    name:
      "Update pipeline smoke test",

    command: [
      "scripts/test-update-pipeline.js",
      "--limit=5"
    ]
  },

  {
    name:
      "Ranking Fail Safe test",

    command: [
      "scripts/test-ranking-fail-safe.js"
    ]
  },

  {
    name:
      "JSON / SQLite consistency check",

    command: [
      "scripts/check-json-sqlite-consistency.js"
    ]
  }
];

const NETWORK_CHECK = {
  name:
    "Update integration test",

  command: [
    "scripts/test-update-integration.js",
    "--wait-ms=2000",
    "--candidate-limit=5"
  ]
};

function parseArgs(argv) {
  return {
    withNetwork:
      argv.includes(
        "--with-network"
      )
  };
}

function printHeader(title) {
  console.log("");

  console.log(
    "=".repeat(60)
  );

  console.log(title);

  console.log(
    "=".repeat(60)
  );

  console.log("");
}

function printCheckStart({
  index,
  total,
  name,
  command
}) {
  console.log("");

  console.log(
    "-".repeat(60)
  );

  console.log(
    `[${index}/${total}] ${name}`
  );

  console.log(
    "-".repeat(60)
  );

  console.log("");

  console.log(
    `node ${command.join(" ")}`
  );

  console.log("");
}

function runCheck(check) {
  const result =
    spawnSync(
      process.execPath,
      check.command,
      {
        stdio: "inherit",
        shell: false
      }
    );

  if (result.error) {
    return {
      passed: false,
      error:
        result.error.message,
      exitCode:
        null
    };
  }

  const exitCode =
    result.status ?? 1;

  return {
    passed:
      exitCode === 0,

    error:
      null,

    exitCode
  };
}

function printFinalSummary(
  results
) {
  printHeader(
    "MixArchive project health summary"
  );

  for (const result of results) {
    const status =
      result.passed
        ? "PASS"
        : "FAIL";

    console.log(
      `${status}: ${result.name}`
    );

    if (
      !result.passed &&
      result.error
    ) {
      console.log(
        `  error: ${result.error}`
      );
    }

    if (
      !result.passed &&
      result.exitCode !== null
    ) {
      console.log(
        `  exitCode: ${result.exitCode}`
      );
    }
  }

  console.log("");

  const passedCount =
    results.filter(
      result =>
        result.passed
    ).length;

  const failedCount =
    results.length -
    passedCount;

  console.log(
    `Passed: ${passedCount}`
  );

  console.log(
    `Failed: ${failedCount}`
  );

  console.log(
    `Total:  ${results.length}`
  );

  console.log("");

  if (failedCount === 0) {
    console.log(
      "All MixArchive project health checks passed."
    );
  } else {
    console.log(
      "One or more MixArchive project health checks failed."
    );
  }
}

function main() {
  const options =
    parseArgs(
      process.argv.slice(2)
    );

  const checks = [
    ...CHECKS
  ];

  if (options.withNetwork) {
    checks.push(
      NETWORK_CHECK
    );
  }

  printHeader(
    "MixArchive project health check"
  );

  console.log({
    withNetwork:
      options.withNetwork,

    checkCount:
      checks.length
  });

  console.log("");

  if (!options.withNetwork) {
    console.log(
      "Network integration test is skipped."
    );

    console.log(
      "Use --with-network to include it."
    );
  }

  const results = [];

  for (
    let index = 0;
    index < checks.length;
    index += 1
  ) {
    const check =
      checks[index];

    printCheckStart({
      index:
        index + 1,

      total:
        checks.length,

      name:
        check.name,

      command:
        check.command
    });

    const result =
      runCheck(check);

    results.push({
      name:
        check.name,

      ...result
    });

    if (result.passed) {
      console.log("");

      console.log(
        `PASS: ${check.name}`
      );
    } else {
      console.log("");

      console.log(
        `FAIL: ${check.name}`
      );
    }
  }

  printFinalSummary(
    results
  );

  const hasFailure =
    results.some(
      result =>
        !result.passed
    );

  if (hasFailure) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error("");

  console.error(
    "MixArchive project health check failed."
  );

  console.error("");

  console.error(error);

  process.exit(1);
}