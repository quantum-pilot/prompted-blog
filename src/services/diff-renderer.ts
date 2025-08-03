import { ErrorHandler } from '../utils/error-handler.js';
import type { RevisionData } from '../types/index.js';

export class DiffRenderer {
  private static errorHandler = ErrorHandler.getInstance();
  // Build diff for first revision (all additions)
  static buildFirstRevision(name: string, lines: string[]): string {
    if (lines.length === 0) lines = [''];
    return [
      `--- /dev/null`,
      `+++ b/${name}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map(l => `+${l}`)
    ].join('\n');
  }

  // Build unchanged diff
  static buildUnchanged(name: string, lines: string[]): string {
    if (lines.length === 0) lines = [''];
    return [
      `--- a/${name}`,
      `+++ b/${name}`,
      `@@ -0,0 +0,0 @@`,
      ` `, // dummy line for diff2html parsing
      `@@ -0,0 +1,0 @@`,
      ...lines.map(l => ` ${l}`)
    ].join('\n');
  }

  // Build diff with context
  static buildDiffWithContext(diff: string, content: string): string {
    const contentLines = content.split('\n');
    const diffLines = diff.split('\n');

    let result = '';
    let contentLineIndex = 0;

    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          const startLine = parseInt(match[2]) - 1;
          contentLineIndex = startLine;
        }
        result += line + '\n';
      } else if (line.startsWith('---') || line.startsWith('+++')) {
        result += line + '\n';
      } else if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
        result += line + '\n';
        if (line.startsWith(' ')) {
          contentLineIndex++;
        }
      } else if (line.trim() === '') {
        result += line + '\n';
      } else {
        // Context line from content
        if (contentLineIndex < contentLines.length) {
          result += ` ${contentLines[contentLineIndex]}\n`;
          contentLineIndex++;
        }
      }
    }

    return result;
  }

  // Render diff using diff2html
  static renderDiffInContainer(container: HTMLElement, diffContent: string, unchanged: boolean = false, outputFormat: 'side-by-side' | 'line-by-line' = 'side-by-side'): void {
    try {
      const html = (window as any).Diff2Html.html(diffContent, {
        drawFileList: false,
        matching: outputFormat === 'side-by-side' ? 'words' : 'lines',
        outputFormat: outputFormat
      });

      container.innerHTML = html;

      // Remove "changed" tag if unchanged
      if (unchanged) {
        const tag = container.querySelector('.d2h-tag');
        if (tag) tag.remove();
        
        // Add class to indicate unchanged content for CSS targeting
        container.classList.add('diff-unchanged');
      }

      // Apply sticky header styling
      const fileHeader = container.querySelector('.d2h-file-header') as HTMLElement;
      const fileContent = container.querySelector('.d2h-file-diff') as HTMLElement;

      if (fileHeader) {
        fileHeader.style.position = 'sticky';
        fileHeader.style.top = '0';
        fileHeader.style.zIndex = '10';
        fileHeader.style.backgroundColor = '#f6f8fa';
      }

      if (fileContent) {
        fileContent.style.overflow = 'visible';
        fileContent.style.overflowY = 'visible';
        fileContent.style.maxHeight = 'none';
      }

      // Auto-scroll to first change if there are modifications
      if (!unchanged) {
        setTimeout(() => DiffRenderer.scrollToFirstChange(container), 100);
      }
    } catch (error) {
      const fallbackMessage = DiffRenderer.errorHandler.handleRenderError(
        error as Error,
        'DiffRenderer.renderDiffInContainer',
        'Failed to render diff content.'
      );
      container.textContent = fallbackMessage;
    }
  }

  static scrollToFirstChange(container: HTMLElement): void {
    const firstChange = container.querySelector('.d2h-ins, .d2h-del, .d2h-change');

    if (firstChange) {
      const containerRect = container.getBoundingClientRect();
      const changeRect = firstChange.getBoundingClientRect();
      const offset = changeRect.top - containerRect.top;

      container.scrollTo({
        top: container.scrollTop + offset - 100,
        behavior: 'smooth'
      });
    }
  }

  // Render file revision content in container (unified method)
  static async renderFileRevision(
    fileName: string,
    dir: string,
    displayName: string,
    container: HTMLElement,
    revision: RevisionData,
    revisionIndex: number,
    revisions: RevisionData[],
    apiService: any
  ): Promise<void> {
    try {
      const fileInRev = revision.files.get(fileName);

      if (fileInRev) {
        // File changed in this revision
        if (fileInRev.revIdx === 0) {
          // First revision - show as all additions
          const content = await apiService.getFileContent(fileName, dir, fileInRev.revIdx);
          const diffContent = DiffRenderer.buildFirstRevision(displayName, content.split('\n'));
          DiffRenderer.renderDiffInContainer(container, diffContent, false, 'line-by-line');
        } else {
          // Regular revision - show diff with context
          const [diff, content] = await Promise.all([
            apiService.getDiff(fileName, dir, fileInRev.revIdx),
            apiService.getFileContent(fileName, dir, fileInRev.revIdx)
          ]);

          const full = content.split('\n');
          const unchanged = !diff;
          const diffContent = unchanged ?
            DiffRenderer.buildUnchanged(displayName, full) :
            DiffRenderer.expandDiff(diff!, full, displayName);

          DiffRenderer.renderDiffInContainer(container, diffContent, unchanged, 'line-by-line');
        }
      } else {
        // Find most recent version of this file before current revision
        let mostRecentContent = '';
        for (let i = revisionIndex - 1; i >= 0; i--) {
          if (revisions[i].files.has(fileName)) {
            const fileInfo = revisions[i].files.get(fileName);
            if (fileInfo) {
              mostRecentContent = await apiService.getFileContent(fileName, dir, fileInfo.revIdx);
              break;
            }
          }
        }

        const lines = mostRecentContent ? mostRecentContent.split('\n') : [];
        const diffContent = DiffRenderer.buildUnchanged(displayName, lines);
        DiffRenderer.renderDiffInContainer(container, diffContent, true, 'line-by-line');
      }
    } catch (error) {
      const fallbackMessage = DiffRenderer.errorHandler.handleRenderError(
        error as Error,
        'DiffRenderer.renderFileRevision',
        'Failed to render file revision content.'
      );
      container.textContent = fallbackMessage;
    }
  }

  // Expand diff with full file context (shared method)
  static expandDiff(diffText: string, fullLines: string[], displayName: string): string {
    if (!diffText) return '';

    const src = diffText.split('\n');
    const out = [];
    let i = 0;

    // Process headers
    while (i < src.length && !src[i].startsWith('@@')) {
      let line = src[i++];
      // Replace full paths with display names
      if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
        const prefix = line.substring(0, 6);
        line = prefix + displayName;
      }
      out.push(line);
    }

    // Check if diff starts at line 1
    let startsAtLineOne = false;
    if (i < src.length) {
      const firstHunk = src[i];
      const m = /@@ -(\d+)/.exec(firstHunk);
      startsAtLineOne = m !== null && +m[1] === 1;
    }

    // Add dummy header if diff doesn't start at line 1
    if (!startsAtLineOne) {
      out.push(`@@ -0,0 +0,0 @@`);
      out.push(` `); // dummy line
    }

    let prevNew = 1;
    while (i < src.length) {
      const head = src[i];
      const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(head);
      if (!m) {
        out.push(src[i++]);
        continue;
      }

      const newStart = +m[1];
      const newCount = +(m[2] || 1);

      // Add context lines before the hunk
      for (let ln = prevNew; ln < newStart; ln++) {
        out.push(' ' + (fullLines[ln - 1] || ''));
      }

      out.push(head);
      i++;

      // Add hunk content
      while (i < src.length && !src[i].startsWith('@@')) {
        out.push(src[i++]);
      }

      prevNew = newStart + newCount;
    }

    // Add remaining context lines
    for (let ln = prevNew; ln <= fullLines.length; ln++) {
      out.push(' ' + (fullLines[ln - 1] || ''));
    }

    return out.join('\n');
  }
}
