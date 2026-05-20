// import { useAppSelector } from "@/Store/store";
// import { useMemo } from "react";

// const useSetPermissions = () => {
//   const permissions = useAppSelector((state) => state.auth.permissions);

//   const newPermissionsSet = useMemo(
//     () => new Set(permissions?.map((p) => p.slug) || []),
//     [permissions]
//   );

//   /**
//    * Utility function to check if a specific permission exists.
//    * @param {string} permissionSlug - The slug of the permission to check.
//    * @returns {boolean} - Whether the permission exists.
//    */
//   const hasPermission = (permissionSlug: string): boolean => {
//     return newPermissionsSet.has(permissionSlug);
//   };

//   /**
//    * Hook to handl  e route guard logic.
//    * @param permission - Permission slug to check.
//    * @param userKey - User key to validate (e.g., "warehousing").
//    * @returns { isAllowed: boolean } - Whether the user is allowed.
//    */


//   return { newPermissionsSet, hasPermission };
// };

// export default useSetPermissions;
