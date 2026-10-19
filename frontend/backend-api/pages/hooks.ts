import { useQuery } from '@tanstack/react-query';
import { fetchPages, fetchPageById, fetchPageBySlug, fetchPagesNavigation } from './queries';

export const PAGES_QUERY_KEY = 'pages';

export const usePagesQuery = () => {
    return useQuery({
        queryKey: [PAGES_QUERY_KEY],
        queryFn: () => fetchPages(),
    });
};

export const usePageByIdQuery = (id: string) => {
    return useQuery({
        queryKey: [PAGES_QUERY_KEY, id],
        queryFn: () => fetchPageById(id),
        enabled: !!id,
    });
};

export const usePageBySlugQuery = (slug: string) => {
    return useQuery({
        queryKey: [PAGES_QUERY_KEY, 'slug', slug],
        queryFn: () => fetchPageBySlug(slug),
        enabled: !!slug,
        retry: false,
    });
};

export const usePagesNavigationQuery = () => {
    return useQuery({
        queryKey: [PAGES_QUERY_KEY, 'navigation'],
        queryFn: () => fetchPagesNavigation(),
        staleTime: 5 * 60 * 1000,
    });
};
