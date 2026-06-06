
import { Client } from "@notionhq/client";

const notion = new Client({
  auth: "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",
});

async function findProjectPage() {
  const response = await notion.search({
    query: "docker-watchtower-dash",
    filter: {
      property: "object",
      value: "page",
    },
  });

  console.log(JSON.stringify(response.results, null, 2));
}

findProjectPage().catch(console.error);
