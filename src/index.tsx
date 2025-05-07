import { ActionPanel, Action, Detail, getPreferenceValues, List, showToast, Toast, Icon } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import algoliasearch from "algoliasearch/lite";

export default function main() {
  const preferences = getPreferenceValues();

  const algoliaClient = useMemo(() => {
    return algoliasearch(preferences.appId, preferences.apiKey);
  }, [preferences.appId, preferences.apiKey]);

  const algoliaIndex = useMemo(() => {
    return algoliaClient.initIndex(preferences.indexName);
  }, [algoliaClient, preferences.indexName]);

  const [searchResults, setSearchResults] = useState<any[] | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const search = async (query = "") => {
    setIsLoading(true);

    return await algoliaIndex
      .search(query)
      .then((res) => {
        setIsLoading(false);
        return res.hits;
      })
      .catch((err) => {
        setIsLoading(false);
        showToast(Toast.Style.Failure, "Algolia Error", err.message);
        return [];
      });
  };

  useEffect(() => {
    (async () => setSearchResults(await search()))();
  }, []);

  // 伪代码：将 HTML 标签转换为 Markdown（em → *斜体*）
  function convertHighlightToMarkdown(text: string): string {
    return text.replace(/<em>/g, "【").replace(/<\/em>/g, "】");
  }

  return (
    <List
      throttle={true}
      isLoading={isLoading || searchResults === undefined}
      onSearchTextChange={async (query: string | undefined) => setSearchResults(await search(query))}
    >
      <List.Section title="results">
        {searchResults?.map((result) => (
          <List.Item
            key={result.objectID}
            icon={Icon.Dot}
            title={(() => {
              const highlightedValue = result._highlightResult[preferences.mainAttribute].value;
              return convertHighlightToMarkdown(highlightedValue);
            })()}
            subtitle={preferences.secondaryAttribute ? result[preferences.secondaryAttribute] : undefined}
            actions={
              preferences.urlAttribute ? (
                <ActionPanel title={result.name}>
                  <Action.OpenInBrowser url={result.url} title="Open in Browser" />
                </ActionPanel>
              ) : (
                <ActionPanel>
                  <Action.Push
                    title="Show Details"
                    target={
                      <Detail
                        markdown={(() => {
                          const title = `# ${result[preferences.mainAttribute]}`;
                          const description = result.desc ? `\n${result.desc}` : "";
                          const examples = result.examples ? `\n## 示例\n${result.examples}` : "";
                          const comments = result.comment ? `\n## 备注\n${result.comment}` : "";
                          const category = result.category ? `\n## 分类\n${result.category}` : "";

                          return `${title}${description}${examples}${comments}${category}`;
                        })()}
                      />
                    }
                  />
                </ActionPanel>
              )
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
