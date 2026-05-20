import { useQuery } from '@tanstack/react-query';
import { fetchBanners, fetchBannerById } from './queries';

export const BANNERS_QUERY_KEY = 'banners';

export const useBannersQuery = () => {
    return useQuery({
        queryKey: [BANNERS_QUERY_KEY],
        queryFn: () => fetchBanners(),
    });
};

export const useBannerByIdQuery = (id: string) => {
    return useQuery({
        queryKey: [BANNERS_QUERY_KEY, id],
        queryFn: () => fetchBannerById(id),
        enabled: !!id,
    });
};
