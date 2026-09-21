import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export function createValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

export function assertValid(validate, value, label = "data") {
  if (validate(value)) return;
  const message = validate.errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  throw new Error(`Invalid ${label}: ${message}`);
}
