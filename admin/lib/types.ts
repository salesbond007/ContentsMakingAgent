// パイプライン側(src/clients/ctas.ts, src/clients/styleReferences.ts)の型と同じ形。
// 管理画面はパイプラインのソースを直接importせず、config/*.jsonの構造だけを共有する。

export interface CtaOption {
  id: string;
  label: string;
  url: string;
  buttonText: string;
  useWhen: string;
}

export interface CtasFile {
  _comment?: string;
  _internal_link_comment?: string;
  ctas: CtaOption[];
}

export interface StyleReference {
  label: string;
  url: string;
  note: string;
}

export interface StyleReferencesFile {
  _comment?: string;
  references: StyleReference[];
}
