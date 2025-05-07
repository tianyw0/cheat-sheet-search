import { ActionPanel, Action, Detail, getPreferenceValues, List, showToast, Toast, Icon, Grid } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { instantMeiliSearch } from "@meilisearch/instant-meilisearch";

// 定义一个更准确的 MeiliSearch 结果接口
interface MeiliSearchResult {
  objectID: string;
  _formatted?: Partial<Record<string, string>>;
  [key: string]: any; // 允许其他动态属性
}

export default function main() {
  const preferences = getPreferenceValues();

  const searchClient = instantMeiliSearch("http://localhost:7700", "aSampleMasterKey");

  const [searchResults, setSearchResults] = useState<MeiliSearchResult[] | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const search = async (query = "") => {
    setIsLoading(true);

    try {
      const index = searchClient.meiliSearchInstance.index(preferences.indexName);
      // 请求 MeiliSearch 返回高亮结果
      const result = await index.search(query, {
        limit: 20, // 你可以根据需要调整 limit
        attributesToHighlight: ["*"], // 确保请求高亮所有属性，或指定需要的属性
      });
      setIsLoading(false);
      return result.hits as MeiliSearchResult[];
    } catch (err: any) {
      setIsLoading(false);
      showToast(Toast.Style.Failure, "MeiliSearch Error", err.message);
      return [];
    }
  };

  useEffect(() => {
    (async () => setSearchResults(await search()))();
  }, []);

  function convertHighlightToMarkdown(text: string): string {
    return text.replace(/<em>/g, "【").replace(/<\/em>/g, "】");
  }

  return (
    <List
      throttle={true}
      isLoading={isLoading || searchResults === undefined}
      onSearchTextChange={async (query: string | undefined) => setSearchResults(await search(query))}
    >
      <List.Section title="Results">
        {searchResults?.map((result) => {
          // 安全地获取 title
          let titleText = result[preferences.mainAttribute] || "No title"; // 默认值
          if (result._formatted && result._formatted[preferences.mainAttribute]) {
            titleText = result._formatted[preferences.mainAttribute]!;
          }

          // 安全地获取 subtitle
          let subtitleText = "";
          if (preferences.secondaryAttribute && result[preferences.secondaryAttribute]) {
            subtitleText = result[preferences.secondaryAttribute];
          } else if (preferences.tertiaryAttribute && Array.isArray(result[preferences.tertiaryAttribute])) {
            subtitleText = result[preferences.tertiaryAttribute]
              .map((item: string, index: number) => `${index + 1}. ${item}`)
              .join(" ");
          }

          return (
            <List.Item
              key={result.id}
              icon={Icon.Dot}
              title={convertHighlightToMarkdown(titleText)}
              subtitle={subtitleText}
              actions={
                preferences.urlAttribute && result.url ? (
                  <ActionPanel title={result.name || titleText}>
                    <Action.OpenInBrowser url={result.url} title="Open in Browser" />
                  </ActionPanel>
                ) : (
                  <ActionPanel title={result.name || titleText}>
                    <Action.Push
                      title="Show Details"
                      target={
                        <Detail
                          markdown={(() => {
                            const detailTitle = `# ${result[preferences.mainAttribute] || titleText}`;
                            const description = result.desc ? `\n${result.desc}` : "";
                            const examples = result.examples ? `\n## 示例\n${result.examples}` : "";
                            const comments = result.comment ? `\n## 备注\n${result.comment}` : "";
                            const category = result.category ? `\n## 分类\n${result.category}` : "";

                            return `${detailTitle}${description}${examples}${comments}${category}`;
                          })()}
                        />
                      }
                    />
                  </ActionPanel>
                )
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
