export function setValidationError({
  graphQLErrors,
  setError,
}: {
  graphQLErrors: any,
  setError: any,
}) {
  const vali = graphQLErrors?.[0]?.extensions;

  if (vali?.category === "validation") {
    const validation = Object.entries(vali.validation).map(
      ([key, messages]: any) => ({
        message: messages[0],
        name: key,
      })
    );

    validation.forEach(({ name, message }) => {
      let fieldName = name.replace("input.", "");

      if (fieldName === "images") {
        fieldName = "fileName";
      }

      setError(fieldName, {
        type: "required",
        message: message,
        shouldFocus: true,
      });
    });
  }
}