import { createFormHook, revalidateLogic } from "@tanstack/react-form"

import { FieldError } from "./field-error"
import { fieldContext, formContext, useFieldContext } from "./form-context"
import { SelectField } from "./select-field"
import { SubmitButton } from "./submit-button"
import { TextField } from "./text-field"

/**
 * The app's forms: TanStack's `useForm` with this kit's parts bound in, so a
 * field is `<form.AppField name="email">{(f) => <f.TextField label="Email" />}</form.AppField>`
 * and gets its label, error wiring and styling without repeating them.
 */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, SelectField },
  formComponents: { SubmitButton },
})

/**
 * Checks on submit first, then on every change once a submit has failed: no
 * one is told their half-typed email is wrong, and a mistake clears the moment
 * it is fixed. Pass as `validationLogic` with the schema under
 * `validators.onDynamic`.
 */
export const validateOnSubmitThenChange = () =>
  revalidateLogic({ mode: "submit", modeAfterSubmission: "change" })

export { FieldError, useFieldContext }
