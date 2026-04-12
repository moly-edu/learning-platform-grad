import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_PAT, // PAT có quyền read repo
});

interface GetBuiltHtmlOptions {
  runId: string;
  ref?: string; // default: main
}

/**
 * Lấy nội dung index.html từ widget-builder theo runId
 */
export async function getBuiltWidgetHtml({
  runId,
  ref = "main",
}: GetBuiltHtmlOptions): Promise<string> {
  const path = `${runId}/index.html`;
  const [owner, repo] = process.env.WIDGET_BUILDER_REPO!.split("/");

  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  if (Array.isArray(response.data)) {
    throw new Error("Expected a file but received a directory");
  }

  if (response.data.type !== "file") {
    throw new Error("Path is not a file");
  }

  const { content, encoding } = response.data;

  if (encoding === "base64") {
    // Decode base64 -> UTF-8 string
    return Buffer.from(content, "base64").toString("utf-8");
  }

  if (encoding === "none") {
    // GitHub Contents API can return encoding "none" for larger files.
    // Fallback to blob API by sha so private repos still work with PAT auth.
    const blobResponse = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: response.data.sha,
    });

    if (blobResponse.data.encoding !== "base64") {
      throw new Error(
        `Unsupported blob encoding: ${blobResponse.data.encoding}`,
      );
    }

    return Buffer.from(blobResponse.data.content, "base64").toString("utf-8");
  }

  throw new Error(`Unsupported encoding: ${encoding}`);
}
