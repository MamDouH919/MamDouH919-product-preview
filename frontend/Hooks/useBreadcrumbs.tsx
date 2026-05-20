'use client';

import { useAppSelector } from '@/Store/store';
// import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

// type BreadcrumbItem = {
//     title: string;
//     link: string;
// };

// // This allows to add custom title as well
// const routeMapping: Record<string, BreadcrumbItem[]> = {
//     '/dashboard/meal-plans':
//         [{ title: 'Dashboard', link: '/dashboard' },
//         { title: 'Meal Plans', link: '/dashboard/meal-plans' }],

//     // Add more custom mappings as needed
// };

export function useBreadcrumbs() {
    // const pathname = usePathname();

    const { breadCrumb } = useAppSelector(state => state.breadCrumb);
    console.log({ breadCrumb });
    

    const breadcrumbs = useMemo(() => {
        // Check if we have a custom mapping for this exact path
        // if (routeMapping[pathname]) {
        //     return routeMapping[pathname];
        // }

        // If no exact match, fall back to generating breadcrumbs from the path
        // const segments = pathname.split('/').filter(Boolean);

        if (breadCrumb) {
            return breadCrumb.map((item) => {
                return {
                    title: item.title,
                    link: item.link
                };
            });
        }

        // return segments.map((segment, index) => {
        //     const path = `/${segments.slice(0, index + 1).join('/')}`;
        //     return {
        //         title: segment.charAt(0).toUpperCase() + segment.slice(1),
        //         link: path
        //     };
        // });
    }, [breadCrumb]);

    return breadcrumbs;
}