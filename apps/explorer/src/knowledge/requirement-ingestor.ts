import {
    readFile,
  } from 'node:fs/promises';
  
  import {
    extname,
  } from 'node:path';
  
  import {
    requirementContextSchema,
    type RequirementContext,
  } from './knowledge-contracts.js';
  
  const SUPPORTED_EXTENSIONS =
    new Set([
      '.md',
      '.txt',
    ]);
  
  const ROLE_PATTERN =
    /\b(admin|administrator|user|customer|guest|manager|owner|operator|agent|staff|developer|qa|tester)\b/gi;
  
  const CONSTRAINT_TERMS = [
    'must',
    'must not',
    'should',
    'should not',
    'cannot',
    'required',
    'only',
    'maximum',
    'minimum',
  ];
  
  function unique(
    values: string[],
  ): string[] {
    return [
      ...new Set(
        values
          .map(
            (value) =>
              value.trim(),
          )
          .filter(Boolean),
      ),
    ];
  }
  
  function extractBulletLines(
    text: string,
  ): string[] {
    return text
      .split('\n')
      .map(
        (line) =>
          line.trim(),
      )
      .filter(
        (line) =>
          /^[-*+]\s+/.test(
            line,
          ) ||
          /^\d+\.\s+/.test(
            line,
          ),
      )
      .map(
        (line) =>
          line.replace(
            /^([-*+]|\d+\.)\s+/,
            '',
          ),
      );
  }
  
  function extractSection(
    text: string,
    names: string[],
  ): string[] {
    const lines =
      text.split('\n');
  
    const output:
      string[] = [];
  
    let collecting = false;
  
    for (
      const rawLine of lines
    ) {
      const line =
        rawLine.trim();
  
      const headingMatch =
        line.match(
          /^#{1,6}\s+(.+)$/,
        );
  
      if (headingMatch) {
        const heading =
          headingMatch[1]
            ?.toLowerCase()
            .trim();
  
        collecting =
          heading !== undefined &&
          names.some(
            (name) =>
              heading.includes(
                name,
              ),
          );
  
        continue;
      }
  
      if (
        collecting &&
        line
      ) {
        const cleaned =
          line.replace(
            /^([-*+]|\d+\.)\s+/,
            '',
          );
  
        if (cleaned) {
          output.push(
            cleaned,
          );
        }
      }
    }
  
    return unique(output);
  }
  
  function extractRoles(
    text: string,
  ): string[] {
    const explicitRoles =
      extractSection(
        text,
        [
          'user roles',
          'roles',
        ],
      );
  
    if (
      explicitRoles.length >
      0
    ) {
      return unique(
        explicitRoles.map(
          (role) =>
            role.toLowerCase(),
        ),
      );
    }
  
    const matches =
      text.match(
        ROLE_PATTERN,
      ) ?? [];
  
    return unique(
      matches.map(
        (value) =>
          value.toLowerCase(),
      ),
    );
  }
  
  function extractConstraints(
    text: string,
  ): string[] {
    return unique(
      text
        .split('\n')
        .map(
          (line) =>
            line.trim(),
        )
        .filter(
          (line) => {
            const normalized =
              line.toLowerCase();
  
            return CONSTRAINT_TERMS.some(
              (term) =>
                normalized.includes(
                  term,
                ),
            );
          },
        )
        .map(
          (line) =>
            line.replace(
              /^[-*+]\s+/,
              '',
            ),
        ),
    );
  }
  
  function extractDomainTerms(
    text: string,
  ): string[] {
    const candidates =
      text.match(
        /\b[A-Z][A-Za-z0-9-]{2,}\b/g,
      ) ?? [];
  
    return unique(
      candidates,
    ).slice(
      0,
      100,
    );
  }
  
  export async function ingestRequirements(
    sourcePath: string,
  ): Promise<
    RequirementContext
  > {
    const extension =
      extname(
        sourcePath,
      ).toLowerCase();
  
    if (
      !SUPPORTED_EXTENSIONS.has(
        extension,
      )
    ) {
      throw new Error(
        `Unsupported requirement file type: ${extension}`,
      );
    }
  
    const rawText =
      await readFile(
        sourcePath,
        'utf8',
      );
  
    const acceptanceCriteria =
      extractSection(
        rawText,
        [
          'acceptance criteria',
          'acceptance',
          'criteria',
        ],
      );
  
    const capabilities =
      extractSection(
        rawText,
        [
          'capabilities',
          'features',
          'requirements',
          'functional requirements',
        ],
      );
  
    const explicitConstraints =
      extractSection(
        rawText,
        [
          'constraints',
          'rules',
          'business rules',
        ],
      );
  
    return requirementContextSchema.parse({
      sourcePath,
  
      acceptanceCriteria:
        acceptanceCriteria.length >
        0
          ? acceptanceCriteria
          : extractBulletLines(
              rawText,
            ),
  
      userRoles:
        extractRoles(
          rawText,
        ),
  
      capabilities,
  
      constraints:
        unique([
          ...explicitConstraints,
          ...extractConstraints(
            rawText,
          ),
        ]),
  
      domainTerms:
        extractDomainTerms(
          rawText,
        ),
  
      rawText,
    });
  }