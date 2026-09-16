declare module "mammoth/mammoth.browser" {
  interface ConvertInput {
    arrayBuffer: ArrayBuffer;
  }

  interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface MammothBrowser {
    convertToHtml(input: ConvertInput): Promise<ConvertResult>;
  }

  const mammoth: MammothBrowser;
  export default mammoth;
}
