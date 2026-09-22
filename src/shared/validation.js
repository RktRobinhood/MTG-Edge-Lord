import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export function createValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

/** Errors reported before the message is truncated. A columnar dataset can
 * produce one error per element, and thousands of them bury the first. */
const MAX_REPORTED_ERRORS = 12;

export function assertValid(validate, value, label = "data") {
  if (validate(value)) return;
  const errors = validate.errors.map((error) => `${error.instancePath || "/"} ${error.message}`);
  const shown = errors.slice(0, MAX_REPORTED_ERRORS).join("; ");
  const rest = errors.length > MAX_REPORTED_ERRORS ? ` (and ${errors.length - MAX_REPORTED_ERRORS} more)` : "";
  throw new Error(`Invalid ${label}: ${shown}${rest}`);
}
