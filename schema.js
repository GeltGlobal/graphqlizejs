const mapTypes = {
  ID: "ID",
  TEXT: "String",
  STRING: "String",
  CHAR: "String",
  UUID: "String",
  UUIDV1: "String",
  UUIDV4: "String",
  DATE: "String",
  TIME: "String",
  INTEGER: "Int",
  TINYINT: "Int",
  SMALLINT: "Int",
  MEDIUMINT: "Int",
  BIGINT: "Int",
  FLOAT: "Float",
  DOUBLE: "Float",
  REAL: "Float",
  DECIMALS: "Float",
  DECIMAL: "Float",
  BOOLEAN: "Boolean",
  VIRTUAL: "String"
};

export function generateOperatorInputs() {
  return `
input _inputStringOperator {
        eq: String,
        ne: String,
        gte: String,
        gt: String,
        lte: String,
        lt: String,
        not: String,
        is: [String],
        in: [String],
        notIn: [String],
        like: String,
        notLike: String,
        iLike: String,
        notILike: String,
        startsWith: String,
        endsWith: String,
        substring: String,
        regexp: String,
        notRegexp: String,
        iRegexp: String,
        notIRegexp: String,
        between: [String],
        notBetween: [String],
        overlap: [String],
        contains: [String],
        contained: [String],
        adjacent: [String],
        strictLeft: [String],
        strictRight: [String],
        noExtendRight: [String],
        noExtendLeft: [String],
        and: [String],
        or: [String],
        any: [String],
        all: [String],
        values: [String],
        col: [String],
        placeholder: [String],
    }
  `;
}

export function generateTypes(db, additionalTypes = []) {
  return Object.keys(db.sequelize.models)
    .map(modelName => {
      if (!db.sequelize.models[modelName]) return;

      const model = db.sequelize.models[modelName];
      let typeName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
      const attrs = db.sequelize.models[modelName].attributes;
      let fields = Object.keys(attrs)
        .map(attr => {
          if (attrs[attr].primaryKey) return `${attr}: ID!`;
          const allowNull = attrs[attr].allowNull ? "" : "!";
          let type = mapTypes[attrs[attr].type.key] || attrs[attr].type.key;
          if (attrs[attr].gqType) {
            type = mapTypes[attrs[attr].gqType] || attrs[attr].gqType;
          }

          return `  ${attr}: ${type}${allowNull}`;
        })
        .filter(r => r)
        .join("\n");

      const associations = db.sequelize.models[modelName].associations || {};

      const associatesFields = Object.keys(associations)
        .map(association => {
          let a =
            associations[association].options.name.singular ||
            associations[association].options.name;

          if (!db.sequelize.models[a])
            a =
              associations[association].target.name.singular ||
              associations[association].target.name;

          let associationModel = db.sequelize.models[a];

          let associationName = a.charAt(0).toUpperCase() + a.slice(1);

          if (associationName === "Item")
            console.log("associations[association]", associations[association]);

          if (
            associations[association].isMultiAssociation &&
            associationModel
          ) {
            console.log("isMultiassociation", a, associationModel);
            return [
              `${associations[association].as}(${generateSearchFields(
                associationModel
              ).join(", ")}): [${associationName}!]!`,
              `${associations[association].as}Count(${generateSearchFields(
                associationModel
              ).join(", ")}): Int!`
            ].join("\n");
          }

          return `${associations[association].as}: ${associationName}!`;
        })
        .filter(r => r)
        .join("\n");

      const type = `
              type ${typeName} {
                ${fields}
                ${associatesFields}
              }`;
      const createInputType = `
              input _createInput${typeName} {
                ${generateCreateFields(model).join("\n")}
              }`;
      const updateInputType = `
              input _updateInput${typeName} {
                ${generateUpdateFields(model).join("\n")}
              }`;

      return [type, createInputType, updateInputType].join("\n");
    })
    .concat(additionalTypes)
    .filter(r => r)
    .join("\n");
}

export function generateTableHandlerFields() {
  return [
    "_offset: Int",
    "_limit: Int",
    "_orderBy: [[String!]!]",
    "_group: [String!]"
  ];
}

export function generateIdFields(model, allowNull = false) {
  const attrs = model.attributes;
  return Object.keys(attrs)
    .map(attr => {
      if (!model._isPrimaryKey(attr)) return;
      return `${attr}: _inputStringOperator${allowNull ? "" : "!"}`;
    })
    .filter(r => r);
}
/**
 * you can set the attribute of model to be not searchable:
 * @example
 *    //...other model attributes,
 *    description: { type: DataTypes.STRING, allowNull: true, gqSearch: true }
 *
 * @param {SequelizeModel} model
 */
export function generateSearchFields(model) {
  const attrs = model.attributes;

  let fields = Object.keys(attrs)
    .map(attr => {
      if (attrs[attr].gqSearch === false || attrs[attr].type.key === "VIRTUAL")
        return;

      let type = "_inputStringOperator";
      if (model.generateGqSearchOperation === false)
        type = mapTypes[attrs[attr].type.key] || attrs[attr].type.key;

      return `${attr}: ${type}`;
    })
    .concat(generateIdFields(model, true));

  if (model.generateGqTableHandler !== false) {
    fields = fields.concat(generateTableHandlerFields());
  }

  return fields.filter(r => r);
}

/**
 * you can set the attribute of model to be not creatable:
 * @example
 *    //...other model attributes,
 *    description: { type: DataTypes.STRING, allowNull: true, gqCreate: true }
 *
 * @param {SequelizeModel} model
 */
export function generateCreateFields(model, opts = {}) {
  const attrs = model.attributes;

  let fields = Object.keys(attrs).map(attr => {
    if (attrs[attr].gqCreate === false) return;

    // PK it's auto increment, don't send
    if (attrs[attr].primaryKey && attrs[attr].autoIncrement) return;

    // It's PK and not auto increment, you should provide the value
    if (attrs[attr].primaryKey) return `${attr}: ID!`;

    let allowNull = attrs[attr].allowNull ? "" : "!";

    // don't force send timestamps, this is auto-generated by sequelize
    if (
      model.options.timestamps &&
      (model._timestampAttributes.createdAt === attr ||
        model._timestampAttributes.updatedAt === attr)
    )
      allowNull = "";

    const type = mapTypes[attrs[attr].type.key] || attrs[attr].type.key;

    return `${attr}: ${type}${allowNull}`;
  });

  return fields.filter(r => r);
}

/**
 * you can set the attribute of model to be not updatable:
 * @example
 *    //...other model attributes,
 *    description: { type: DataTypes.STRING, allowNull: true, gqCreate: true }
 *
 * @param {SequelizeModel} model
 */
export function generateUpdateFields(model) {
  const attrs = model.attributes;
  let fields = Object.keys(attrs).map(attr => {
    if (attrs[attr].gqUpdate === false) return;

    if (attrs[attr].primaryKey) return;

    const type = mapTypes[attrs[attr].type.key] || attrs[attr].type.key;
    return `${attr}: ${type}`;
  });

  return fields.filter(r => r);
}

export function generateQueries(db, additionalQueries = []) {
  const queries = Object.keys(db)
    .map(modelName => {
      if (!db.sequelize.models[modelName]) return;

      const model = db.sequelize.models[modelName];

      if (model.generateGqSearch === false) return;

      const plural = model.options.name.plural;
      const singular = model.options.name.singular;
      const typeName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

      const searchFields = generateSearchFields(model).join(", ");

      return [
        `  ${plural}(${searchFields}): [${typeName}!]!`,
        `  ${plural}Count(${searchFields}): Int`,
        `  ${singular}(${searchFields}): ${typeName}`
      ].join("\n");
    })
    .concat(additionalQueries)
    .filter(r => r)
    .join("\n");
  return `
      type Query {
      ${queries}
      ${additionalQueries}
      }`;
}

export function generateMutations(db, additionalMutations = []) {
  const mutations = Object.keys(db)
    .map(modelName => {
      if (!db.sequelize.models[modelName]) return;
      const model = db.sequelize.models[modelName];

      const singular = model.options.name.singular;
      const singularFU = singular.charAt(0).toUpperCase() + singular.slice(1);
      const typeName = modelName.charAt(0).toUpperCase() + modelName.slice(1);

      const mutationUpdateFields = generateUpdateFields(model)
        .join(", ")
        .trim();

      const mutationCreateFields = generateCreateFields(model)
        .join(", ")
        .trim();

      return [
        model.generateGqCreate !== false &&
          `create${singularFU}(input: _createInput${typeName}): ${typeName}!`,
        model.generateGqUpdate !== false &&
          `update${singularFU}(${generateIdFields(model).join(
            ", "
          )} ,input: _updateInput${typeName}): [Int]!`,
        model.generateGqDelete !== false &&
          `delete${singularFU}(${generateIdFields(model).join(", ")}): Int!`
      ]
        .filter(r => r)
        .join("\n");
    })
    .concat(additionalMutations)
    .join("\n");

  return `
    type Mutation {
    ${mutations}
    }`;
}

export function generateSchema(db, opts) {
  opts = { query: [], type: [], mutation: [], ...opts };
  return (
    generateOperatorInputs() +
    generateTypes(db, opts.type) +
    generateQueries(db, opts.query) +
    generateMutations(db, opts.mutation)
  );
}
