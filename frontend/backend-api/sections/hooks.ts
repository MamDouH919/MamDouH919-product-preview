import { useQuery } from '@tanstack/react-query';
import { fetchSections, fetchSectionById, fetchSectionByName } from './queries';

export const SECTIONS_QUERY_KEY = 'sections';

export const useSectionsQuery = () => {
    return useQuery({
        queryKey: [SECTIONS_QUERY_KEY],
        queryFn: () => fetchSections(),
    });
};

export const useSectionByIdQuery = (id: string) => {
    return useQuery({
        queryKey: [SECTIONS_QUERY_KEY, id],
        queryFn: () => fetchSectionById(id),
        enabled: !!id,
    });
};

export const useSectionByNameQuery = (sectionName: string) => {
    return useQuery({
        queryKey: [SECTIONS_QUERY_KEY, 'name', sectionName],
        queryFn: () => fetchSectionByName(sectionName),
        enabled: !!sectionName,
    });
};
