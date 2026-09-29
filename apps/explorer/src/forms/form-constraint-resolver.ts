import type {
    ActionElement,
  } from '../contracts/page-observation.js';
  
  import type {
    KnowledgeContext,
    OpenApiContext,
  } from '../knowledge/knowledge-contracts.js';
  
  type UnknownRecord =
    Record<
      string,
      unknown
    >;
  
  export type FormConstraintSource =
    | 'ui'
    | 'openapi'
    | 'requirements';
  
  export type FormConstraintKey =
    | 'required'
    | 'inputType'
    | 'min'
    | 'max'
    | 'step'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'example'
    | 'options';
  
  export interface FormConstraintEvidence {
    source:
      FormConstraintSource;
  
    field:
      FormConstraintKey;
  
    detail:
      string;
  
    sourcePath?:
      string;
  }
  
  export interface FormConstraintConflict {
    field:
      FormConstraintKey;
  
    chosenSource:
      FormConstraintSource;
  
    rejectedSource:
      FormConstraintSource;
  
    chosenValue:
      unknown;
  
    rejectedValue:
      unknown;
  
    reason:
      string;
  }
  
  export interface ResolvedFormConstraints {
    required:
      boolean;
  
    inputType?:
      string;
  
    min?:
      string;
  
    max?:
      string;
  
    step?:
      string;
  
    minLength?:
      number;
  
    maxLength?:
      number;
  
    pattern?:
      string;
  
    example?:
      string | boolean;
  
    options?:
      string[];
  
    evidence:
      FormConstraintEvidence[];
  
    conflicts:
      FormConstraintConflict[];
  }

  export interface FormConstraintResolutionContext {
    apiOperationIds?:
      string[];
  }
  
  interface CandidateConstraints {
    required?:
      boolean;
  
    inputType?:
      string;
  
    min?:
      string;
  
    max?:
      string;
  
    step?:
      string;
  
    minLength?:
      number;
  
    maxLength?:
      number;
  
    pattern?:
      string;
  
    example?:
      string | boolean;
  
    options?:
      string[];
  
    details:
      Partial<
        Record<
          FormConstraintKey,
          string
        >
      >;
  
    sourcePath?:
      string;
  }
  
  interface OpenApiMatch {
    constraints:
      CandidateConstraints;
  
    location:
      string;
  }
  
  export function resolveFormConstraints(
    action:
      ActionElement,
  
    knowledge?:
      KnowledgeContext,
  
    context?:
      FormConstraintResolutionContext,
  ): ResolvedFormConstraints | null {
    const field =
      action.formField;
  
    if (!field) {
      return null;
    }
  
    const evidence:
      FormConstraintEvidence[] = [];
  
    const conflicts:
      FormConstraintConflict[] = [];
  
    const sourceByField =
      new Map<
        FormConstraintKey,
        FormConstraintSource
      >();
  
    const uiOptions =
      field.options
        ?.filter(
          (option) =>
            !option.disabled &&
            option.value !== '',
        )
        .map(
          (option) =>
            option.value,
        );
  
    const resolved:
      ResolvedFormConstraints = {
        required:
          field.required,
  
        ...(field.inputType
          ? {
              inputType:
                field.inputType,
            }
          : {}),
  
        ...(field.min
          ? {
              min:
                field.min,
            }
          : {}),
  
        ...(field.max
          ? {
              max:
                field.max,
            }
          : {}),
  
        ...(field.step
          ? {
              step:
                field.step,
            }
          : {}),
  
        ...(field.minLength !==
        undefined
          ? {
              minLength:
                field.minLength,
            }
          : {}),
  
        ...(field.maxLength !==
        undefined
          ? {
              maxLength:
                field.maxLength,
            }
          : {}),
  
        ...(field.pattern
          ? {
              pattern:
                field.pattern,
            }
          : {}),
  
        ...(uiOptions &&
        uiOptions.length > 0
          ? {
              options:
                uiOptions,
            }
          : {}),
  
        evidence,
  
        conflicts,
      };
  
    recordInitialUiEvidence(
      resolved,
      sourceByField,
      evidence,
    );
  
    const openApiCandidate =
    knowledge?.openApi
      ? findOpenApiConstraints(
          action,
          knowledge.openApi,
          context,
        )
      : null;
  
    if (openApiCandidate) {
      mergeCandidate(
        resolved,
        openApiCandidate,
        'openapi',
        sourceByField,
        evidence,
        conflicts,
      );
    }
  
    const requirementCandidate =
      knowledge?.requirements
        ? findRequirementConstraints(
            action,
            knowledge.requirements
              .constraints,
            knowledge.requirements
              .sourcePath,
        )
        : null;
  
    if (requirementCandidate) {
      mergeCandidate(
        resolved,
        requirementCandidate,
        'requirements',
        sourceByField,
        evidence,
        conflicts,
      );
    }
  
    return resolved;
  }
  
  function recordInitialUiEvidence(
    resolved:
      ResolvedFormConstraints,
  
    sources:
      Map<
        FormConstraintKey,
        FormConstraintSource
      >,
  
    evidence:
      FormConstraintEvidence[],
  ): void {
    addUiEvidence(
      'required',
      resolved.required,
      sources,
      evidence,
    );
  
    if (
      resolved.inputType !==
      undefined
    ) {
      addUiEvidence(
        'inputType',
        resolved.inputType,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.min !==
      undefined
    ) {
      addUiEvidence(
        'min',
        resolved.min,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.max !==
      undefined
    ) {
      addUiEvidence(
        'max',
        resolved.max,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.step !==
      undefined
    ) {
      addUiEvidence(
        'step',
        resolved.step,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.minLength !==
      undefined
    ) {
      addUiEvidence(
        'minLength',
        resolved.minLength,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.maxLength !==
      undefined
    ) {
      addUiEvidence(
        'maxLength',
        resolved.maxLength,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.pattern !==
      undefined
    ) {
      addUiEvidence(
        'pattern',
        resolved.pattern,
        sources,
        evidence,
      );
    }
  
    if (
      resolved.options !==
      undefined
    ) {
      addUiEvidence(
        'options',
        resolved.options,
        sources,
        evidence,
      );
    }
  }
  
  function addUiEvidence(
    field:
      FormConstraintKey,
  
    value:
      unknown,
  
    sources:
      Map<
        FormConstraintKey,
        FormConstraintSource
      >,
  
    evidence:
      FormConstraintEvidence[],
  ): void {
    sources.set(
      field,
      'ui',
    );
  
    evidence.push({
      source:
        'ui',
  
      field,
  
      detail:
        `Observed browser constraint ${field}=${formatValue(value)}`,
    });
  }
  
  function mergeCandidate(
    resolved:
      ResolvedFormConstraints,
  
    candidate:
      CandidateConstraints,
  
    source:
      FormConstraintSource,
  
    sourceByField:
      Map<
        FormConstraintKey,
        FormConstraintSource
      >,
  
    evidence:
      FormConstraintEvidence[],
  
    conflicts:
      FormConstraintConflict[],
  ): void {
    const required =
      mergeValue(
        'required',
        resolved.required,
        candidate.required,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    resolved.required =
      required ??
      resolved.required;
  
    const inputType =
      mergeValue(
        'inputType',
        resolved.inputType,
        candidate.inputType,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      inputType !==
      undefined
    ) {
      resolved.inputType =
        inputType;
    }
  
    const min =
      mergeValue(
        'min',
        resolved.min,
        candidate.min,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      min !==
      undefined
    ) {
      resolved.min =
        min;
    }
  
    const max =
      mergeValue(
        'max',
        resolved.max,
        candidate.max,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      max !==
      undefined
    ) {
      resolved.max =
        max;
    }
  
    const step =
      mergeValue(
        'step',
        resolved.step,
        candidate.step,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      step !==
      undefined
    ) {
      resolved.step =
        step;
    }
  
    const minLength =
      mergeValue(
        'minLength',
        resolved.minLength,
        candidate.minLength,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      minLength !==
      undefined
    ) {
      resolved.minLength =
        minLength;
    }
  
    const maxLength =
      mergeValue(
        'maxLength',
        resolved.maxLength,
        candidate.maxLength,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      maxLength !==
      undefined
    ) {
      resolved.maxLength =
        maxLength;
    }
  
    const pattern =
      mergeValue(
        'pattern',
        resolved.pattern,
        candidate.pattern,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      pattern !==
      undefined
    ) {
      resolved.pattern =
        pattern;
    }
  
    const example =
      mergeValue(
        'example',
        resolved.example,
        candidate.example,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      example !==
      undefined
    ) {
      resolved.example =
        example;
    }
  
    const options =
      mergeValue(
        'options',
        resolved.options,
        candidate.options,
        source,
        candidate,
        sourceByField,
        evidence,
        conflicts,
      );
  
    if (
      options !==
      undefined
    ) {
      resolved.options =
        options;
    }
  }
  
  function mergeValue<T>(
    field:
      FormConstraintKey,
  
    current:
      T | undefined,
  
    candidateValue:
      T | undefined,
  
    candidateSource:
      FormConstraintSource,
  
    candidate:
      CandidateConstraints,
  
    sourceByField:
      Map<
        FormConstraintKey,
        FormConstraintSource
      >,
  
    evidence:
      FormConstraintEvidence[],
  
    conflicts:
      FormConstraintConflict[],
  ): T | undefined {
    if (
      candidateValue ===
      undefined
    ) {
      return current;
    }
  
    const detail =
      candidate.details[field] ??
      `${candidateSource} constraint ${field}=${formatValue(candidateValue)}`;
  
    if (
      current ===
      undefined
    ) {
      sourceByField.set(
        field,
        candidateSource,
      );
  
      evidence.push({
        source:
          candidateSource,
  
        field,
  
        detail,
  
        ...(candidate.sourcePath
          ? {
              sourcePath:
                candidate.sourcePath,
            }
          : {}),
      });
  
      return candidateValue;
    }
  
    const currentSource =
      sourceByField.get(
        field,
      ) ??
      'ui';
  
    if (
      valuesEqual(
        current,
        candidateValue,
      )
    ) {
      evidence.push({
        source:
          candidateSource,
  
        field,
  
        detail,
  
        ...(candidate.sourcePath
          ? {
              sourcePath:
                candidate.sourcePath,
            }
          : {}),
      });
  
      return current;
    }
  
    conflicts.push({
      field,
  
      chosenSource:
        currentSource,
  
      rejectedSource:
        candidateSource,
  
      chosenValue:
        current,
  
      rejectedValue:
        candidateValue,
  
      reason:
        `${currentSource} evidence has higher precedence than ${candidateSource} evidence`,
    });
  
    return current;
  }
  
  function findOpenApiConstraints(
    action:
      ActionElement,
  
    openApi:
      OpenApiContext,
  
    context?:
      FormConstraintResolutionContext,
  ): CandidateConstraints | null {
    const candidateNames =
      getCandidateFieldNames(
        action,
      );
  
    if (
      candidateNames.size ===
      0
    ) {
      return null;
    }
  
    const contextualOperationIds =
      new Set(
        context?.apiOperationIds ??
        [],
      );
  
    // --------------------------------
    // Contextual operation search
    // --------------------------------
  
    if (
      contextualOperationIds.size >
      0
    ) {
      const contextualMatches:
        OpenApiMatch[] = [];
  
      const contextualOperations =
        openApi.operations.filter(
          (operation) =>
            contextualOperationIds.has(
              operation.operationId,
            ),
        );
  
      for (
        const operation of
        contextualOperations
      ) {
        collectOperationRequestBodyMatches(
          operation,
          candidateNames,
          openApi,
          contextualMatches,
        );
      }
  
      // Important:
      // when runtime operation context exists,
      // do NOT fall back to unrelated global
      // schemas if this operation does not
      // contain the field.
      return selectUniqueOpenApiConstraints(
        contextualMatches,
      );
    }
  
    // --------------------------------
    // Context unavailable:
    // retain safe global fallback
    // --------------------------------
  
    const matches:
      OpenApiMatch[] = [];
  
    const schemaEntries =
      Object.entries(
        openApi.schemas,
      ).sort(
        (
          [first],
          [second],
        ) =>
          first.localeCompare(
            second,
          ),
      );
  
    for (
      const [
        schemaName,
        schema,
      ] of schemaEntries
    ) {
      collectOpenApiMatches(
        schema,
        `components.schemas.${schemaName}`,
        candidateNames,
        openApi,
        matches,
        new Set<string>(),
      );
    }
  
    for (
      const operation of
      openApi.operations
    ) {
      collectOperationRequestBodyMatches(
        operation,
        candidateNames,
        openApi,
        matches,
      );
    }
  
    return selectUniqueOpenApiConstraints(
      matches,
    );
  }

  function collectOperationRequestBodyMatches(
    operation:
      OpenApiContext['operations'][number],
  
    candidateNames:
      Set<string>,
  
    openApi:
      OpenApiContext,
  
    matches:
      OpenApiMatch[],
  ): void {
    const requestBodySchemas =
      extractRequestBodySchemas(
        operation.requestBody,
      );
  
    requestBodySchemas.forEach(
      (
        schema,
        index,
      ) => {
        collectOpenApiMatches(
          schema,
          `operations.${operation.operationId}.requestBody.${index}`,
          candidateNames,
          openApi,
          matches,
          new Set<string>(),
        );
      },
    );
  }
  
  function selectUniqueOpenApiConstraints(
    matches:
      OpenApiMatch[],
  ): CandidateConstraints | null {
    if (
      matches.length ===
      0
    ) {
      return null;
    }
  
    const unique =
      new Map<
        string,
        OpenApiMatch
      >();
  
    for (
      const match of
      matches
    ) {
      const key =
        JSON.stringify(
          stripCandidateDetails(
            match.constraints,
          ),
        );
  
      if (
        !unique.has(
          key,
        )
      ) {
        unique.set(
          key,
          match,
        );
      }
    }
  
    if (
      unique.size !==
      1
    ) {
      // More than one incompatible schema
      // remains after contextual narrowing.
      // Choosing one would be a guess.
      return null;
    }
  
    return [
      ...unique.values(),
    ][0]?.constraints ??
      null;
  }
  
  function collectOpenApiMatches(
    value:
      unknown,
  
    location:
      string,
  
    candidateNames:
      Set<string>,
  
    openApi:
      OpenApiContext,
  
    matches:
      OpenApiMatch[],
  
    visitedRefs:
      Set<string>,
  ): void {
    const resolved =
      resolveOpenApiSchema(
        value,
        openApi,
        visitedRefs,
      );
  
    if (
      !isRecord(
        resolved,
      )
    ) {
      return;
    }
  
    const properties =
      isRecord(
        resolved.properties,
      )
        ? resolved.properties
        : null;
  
    const requiredFields =
      new Set(
        Array.isArray(
          resolved.required,
        )
          ? resolved.required.filter(
              (
                item,
              ): item is string =>
                typeof item ===
                'string',
            )
          : [],
      );
  
    if (properties) {
      const entries =
        Object.entries(
          properties,
        ).sort(
          (
            [first],
            [second],
          ) =>
            first.localeCompare(
              second,
            ),
        );
  
      for (
        const [
          propertyName,
          propertySchema,
        ] of entries
      ) {
        const normalizedName =
          normalizeFieldName(
            propertyName,
          );
  
        const propertyLocation =
          `${location}.properties.${propertyName}`;
  
        if (
          candidateNames.has(
            normalizedName,
          )
        ) {
          const constraints =
            extractOpenApiPropertyConstraints(
              propertySchema,
              requiredFields.has(
                propertyName,
              ),
              propertyLocation,
              openApi,
            );
  
          matches.push({
            constraints,
  
            location:
              propertyLocation,
          });
        }
  
        collectOpenApiMatches(
          propertySchema,
          propertyLocation,
          candidateNames,
          openApi,
          matches,
          new Set(
            visitedRefs,
          ),
        );
      }
    }
  
    const items =
      resolved.items;
  
    if (
      items !==
      undefined
    ) {
      collectOpenApiMatches(
        items,
        `${location}.items`,
        candidateNames,
        openApi,
        matches,
        new Set(
          visitedRefs,
        ),
      );
    }
  
    for (
      const compositionKey of [
        'allOf',
        'oneOf',
        'anyOf',
      ] as const
    ) {
      const composition =
        resolved[
          compositionKey
        ];
  
      if (
        !Array.isArray(
          composition,
        )
      ) {
        continue;
      }
  
      composition.forEach(
        (
          item,
          index,
        ) => {
          collectOpenApiMatches(
            item,
            `${location}.${compositionKey}.${index}`,
            candidateNames,
            openApi,
            matches,
            new Set(
              visitedRefs,
            ),
          );
        },
      );
    }
  }
  
  function extractOpenApiPropertyConstraints(
    value:
      unknown,
  
    required:
      boolean,
  
    location:
      string,
  
    openApi:
      OpenApiContext,
  ): CandidateConstraints {
    const schema =
      resolveOpenApiSchema(
        value,
        openApi,
        new Set<string>(),
      );
  
    const record =
      isRecord(schema)
        ? schema
        : {};
  
    const format =
      typeof record.format ===
      'string'
        ? record.format
        : undefined;
  
    const schemaType =
      typeof record.type ===
      'string'
        ? record.type
        : undefined;
  
    const inputType =
      format === 'email'
        ? 'email'
        : format === 'date'
          ? 'date'
          : schemaType ===
            'number' ||
            schemaType ===
              'integer'
            ? 'number'
            : schemaType ===
              'string'
              ? 'text'
              : undefined;
  
    const minimum =
      finiteNumberToString(
        record.minimum,
      );
  
    const maximum =
      finiteNumberToString(
        record.maximum,
      );
  
    const step =
      finiteNumberToString(
        record.multipleOf,
      );
  
    const minLength =
      finiteInteger(
        record.minLength,
      );
  
    const maxLength =
      finiteInteger(
        record.maxLength,
      );
  
    const pattern =
      typeof record.pattern ===
      'string'
        ? record.pattern
        : undefined;
  
    const example =
      primitiveExample(
        record.example,
      ) ??
      primitiveExample(
        record.default,
      );
  
    const options =
      Array.isArray(
        record.enum,
      )
        ? record.enum.flatMap(
            (item) => {
              const primitive =
                primitiveExample(
                  item,
                );
  
              return primitive ===
                undefined
                ? []
                : [
                    String(
                      primitive,
                    ),
                  ];
            },
          )
        : undefined;
  
    const details:
      CandidateConstraints['details'] =
        {
          required:
            `OpenAPI field required=${required} at ${location}`,
        };
  
    if (inputType) {
      details.inputType =
        `OpenAPI schema type/format resolves to ${inputType} at ${location}`;
    }
  
    if (minimum) {
      details.min =
        `OpenAPI minimum=${minimum} at ${location}`;
    }
  
    if (maximum) {
      details.max =
        `OpenAPI maximum=${maximum} at ${location}`;
    }
  
    if (step) {
      details.step =
        `OpenAPI multipleOf=${step} at ${location}`;
    }
  
    if (
      minLength !==
      undefined
    ) {
      details.minLength =
        `OpenAPI minLength=${minLength} at ${location}`;
    }
  
    if (
      maxLength !==
      undefined
    ) {
      details.maxLength =
        `OpenAPI maxLength=${maxLength} at ${location}`;
    }
  
    if (pattern) {
      details.pattern =
        `OpenAPI pattern=${pattern} at ${location}`;
    }
  
    if (
      example !==
      undefined
    ) {
      details.example =
        `OpenAPI example/default observed at ${location}`;
    }
  
    if (
      options &&
      options.length > 0
    ) {
      details.options =
        `OpenAPI enum observed at ${location}`;
    }
  
    return {
      required,
  
      ...(inputType
        ? {
            inputType,
          }
        : {}),
  
      ...(minimum
        ? {
            min:
              minimum,
          }
        : {}),
  
      ...(maximum
        ? {
            max:
              maximum,
          }
        : {}),
  
      ...(step
        ? {
            step,
          }
        : {}),
  
      ...(minLength !==
      undefined
        ? {
            minLength,
          }
        : {}),
  
      ...(maxLength !==
      undefined
        ? {
            maxLength,
          }
        : {}),
  
      ...(pattern
        ? {
            pattern,
          }
        : {}),
  
      ...(example !==
      undefined
        ? {
            example,
          }
        : {}),
  
      ...(options &&
      options.length > 0
        ? {
            options,
          }
        : {}),
  
      details,
  
      sourcePath:
        openApi.sourcePath,
    };
  }
  
  function extractRequestBodySchemas(
    requestBody:
      unknown,
  ): unknown[] {
    if (
      !isRecord(
        requestBody,
      )
    ) {
      return [];
    }
  
    const content =
      isRecord(
        requestBody.content,
      )
        ? requestBody.content
        : null;
  
    if (!content) {
      return [];
    }
  
    return Object.values(
      content,
    ).flatMap(
      (mediaType) =>
        isRecord(
          mediaType,
        ) &&
        mediaType.schema !==
          undefined
          ? [
              mediaType.schema,
            ]
          : [],
    );
  }
  
  function resolveOpenApiSchema(
    value:
      unknown,
  
    openApi:
      OpenApiContext,
  
    visitedRefs:
      Set<string>,
  ): unknown {
    if (
      !isRecord(
        value,
      )
    ) {
      return value;
    }
  
    const ref =
      value.$ref;
  
    if (
      typeof ref !==
      'string'
    ) {
      return value;
    }
  
    if (
      visitedRefs.has(
        ref,
      )
    ) {
      return value;
    }
  
    visitedRefs.add(
      ref,
    );
  
    const prefix =
      '#/components/schemas/';
  
    if (
      !ref.startsWith(
        prefix,
      )
    ) {
      return value;
    }
  
    const schemaName =
      ref.slice(
        prefix.length,
      );
  
    return (
      openApi.schemas[
        schemaName
      ] ??
      value
    );
  }
  
  function findRequirementConstraints(
    action:
      ActionElement,
  
    constraints:
      string[],
  
    sourcePath:
      string,
  ): CandidateConstraints | null {
    const names =
      getCandidateFieldNames(
        action,
      );
  
    if (
      names.size ===
      0
    ) {
      return null;
    }
  
    const result:
      CandidateConstraints = {
        details: {},
  
        sourcePath,
      };
  
    let matched = false;
  
    for (
      const constraint of
      constraints
    ) {
      const normalized =
        normalizeText(
          constraint,
        );
  
      const referencesField =
        [
          ...names,
        ].some(
          (name) =>
            normalized.includes(
              name,
            ),
        );
  
      if (
        !referencesField
      ) {
        continue;
      }
  
      if (
        /\b(required|mandatory)\b/i.test(
          constraint,
        )
      ) {
        result.required =
          true;
  
        result.details.required =
          `Requirement constraint: ${constraint}`;
  
        matched = true;
      } else if (
        /\boptional\b/i.test(
          constraint,
        )
      ) {
        result.required =
          false;
  
        result.details.required =
          `Requirement constraint: ${constraint}`;
  
        matched = true;
      }
  
      const inputType =
        action.formField
          ?.inputType;
  
      if (
        inputType ===
          'number'
      ) {
        const between =
          constraint.match(
            /\bbetween\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)/i,
          );
  
        if (between) {
          const [
            ,
            lower,
            upper,
          ] = between;
  
          if (
            lower !==
            undefined &&
            upper !==
            undefined
          ) {
            result.min =
              lower;
  
            result.max =
              upper;
  
            result.details.min =
              `Requirement constraint: ${constraint}`;
  
            result.details.max =
              `Requirement constraint: ${constraint}`;
  
            matched = true;
          }
        }
      } else {
        const minimumLength =
          constraint.match(
            /\bat least\s+(\d+)\s+characters?\b/i,
          );
  
        if (
          minimumLength?.[1]
        ) {
          result.minLength =
            Number(
              minimumLength[1],
            );
  
          result.details.minLength =
            `Requirement constraint: ${constraint}`;
  
          matched = true;
        }
  
        const maximumLength =
          constraint.match(
            /\b(?:at most|maximum(?: of)?)\s+(\d+)\s+characters?\b/i,
          );
  
        if (
          maximumLength?.[1]
        ) {
          result.maxLength =
            Number(
              maximumLength[1],
            );
  
          result.details.maxLength =
            `Requirement constraint: ${constraint}`;
  
          matched = true;
        }
      }
    }
  
    return matched
      ? result
      : null;
  }
  
  function getCandidateFieldNames(
    action:
      ActionElement,
  ): Set<string> {
    const values = [
      action.formField
        ?.htmlName,
      action.name,
    ];
  
    return new Set(
      values.flatMap(
        (value) => {
          if (!value) {
            return [];
          }
  
          const normalized =
            normalizeFieldName(
              value,
            );
  
          return normalized
            ? [
                normalized,
              ]
            : [];
        },
      ),
    );
  }
  
  function normalizeFieldName(
    value:
      string,
  ): string {
    return value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '',
      )
      .trim();
  }
  
  function normalizeText(
    value:
      string,
  ): string {
    return value
      .toLowerCase()
      .replace(
        /\s+/g,
        ' ',
      )
      .trim();
  }
  
  function stripCandidateDetails(
    candidate:
      CandidateConstraints,
  ): Omit<
    CandidateConstraints,
    'details' | 'sourcePath'
  > {
    const {
      details: _details,
      sourcePath: _sourcePath,
      ...constraints
    } = candidate;
  
    return constraints;
  }
  
  function finiteNumberToString(
    value:
      unknown,
  ): string | undefined {
    return typeof value ===
        'number' &&
      Number.isFinite(
        value,
      )
      ? String(value)
      : undefined;
  }
  
  function finiteInteger(
    value:
      unknown,
  ): number | undefined {
    return typeof value ===
        'number' &&
      Number.isInteger(
        value,
      ) &&
      value >= 0
      ? value
      : undefined;
  }
  
  function primitiveExample(
    value:
      unknown,
  ): string | boolean | undefined {
    if (
      typeof value ===
        'string' ||
      typeof value ===
        'boolean'
    ) {
      return value;
    }
  
    if (
      typeof value ===
        'number' &&
      Number.isFinite(
        value,
      )
    ) {
      return String(
        value,
      );
    }
  
    return undefined;
  }
  
  function isRecord(
    value:
      unknown,
  ): value is UnknownRecord {
    return (
      typeof value ===
        'object' &&
      value !== null &&
      !Array.isArray(
        value,
      )
    );
  }
  
  function valuesEqual(
    first:
      unknown,
  
    second:
      unknown,
  ): boolean {
    return (
      JSON.stringify(
        first,
      ) ===
      JSON.stringify(
        second,
      )
    );
  }
  
  function formatValue(
    value:
      unknown,
  ): string {
    return typeof value ===
      'string'
      ? value
      : JSON.stringify(
          value,
        );
  }