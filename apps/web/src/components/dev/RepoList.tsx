"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

export default function RepoList() {
  const locale = useLocale();
  const isVi = locale === "vi";

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchRepos();
  }, []);

  async function fetchRepos() {
    try {
      const response = await fetch("/api/repos");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (isVi
              ? "Không thể tải danh sách kho mã"
              : "Failed to fetch repositories"),
        );
      }

      setRepos(data.repos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(repo: Repo) {
    setImporting(repo.id);

    try {
      const response = await fetch("/api/widgets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repo.fullName,
          repoUrl: repo.url,
          branch: repo.defaultBranch,
          name: repo.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || (isVi ? "Import thất bại" : "Failed to import"),
        );
      }

      // Redirect to build page
      router.push(`/dev/deploy/${data.widget.id}`);
    } catch (err: any) {
      alert(`${isVi ? "Lỗi" : "Error"}: ${err.message}`);
      setImporting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800">
          {isVi
            ? "Không tìm thấy kho mã nào. Hãy kiểm tra quyền truy cập repository trong phần cài đặt GitHub App."
            : "No repositories found. Make sure you've granted access to repositories in your GitHub App settings."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="bg-card border border-border rounded-lg p-6 hover:border-border/80 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {repo.name}
                </h3>
                {repo.private && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                    {isVi ? "Riêng tư" : "Private"}
                  </span>
                )}
              </div>

              {repo.description && (
                <p className="text-muted-foreground text-sm mb-3">
                  {repo.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  {isVi ? "Nhánh" : "Branch"}: {repo.defaultBranch}
                </span>
                <span>•</span>
                <span>
                  {isVi ? "Cập nhật" : "Updated"}{" "}
                  {new Date(repo.updatedAt).toLocaleDateString(
                    isVi ? "vi-VN" : "en-US",
                  )}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleImport(repo)}
              disabled={importing === repo.id}
              className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {importing === repo.id
                ? isVi
                  ? "Đang import..."
                  : "Importing..."
                : isVi
                  ? "Nhập"
                  : "Import"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
