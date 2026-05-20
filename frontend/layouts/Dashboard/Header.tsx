import { useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Toolbar,
    Tooltip,
} from '@mui/material'
import { styled } from '@mui/material/styles';
import MuiAppBar from '@mui/material/AppBar';
import type { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Logout from '@mui/icons-material/Logout';
import Menu from '@mui/icons-material/Menu';
import LockOutlined from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import useDrawer from '@/Hooks/useDrawer';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/Store/store';
import { resetAuthData } from '@/Store/slices/auth';
import { removeTokenFromCookie } from '@/actions/cookies';
import { setAuthToken } from '@/lib/api';
import { logoutRequest, changePasswordRequest } from '@/backend-api/auth/mutations';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import CustomLink from '@/components/CustomLink';
import { LogoWrapper, LogoWrapperDashboard } from '@/utils/global.style';
import Image from 'next/image';
import { getBackendUri } from '@/utils/helperFunctions';
import TextInputComponent from '@/components/MUI/ControlMUItextField';
import LanguageIcon from '@/components/LanguageIcon';

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme }) => ({
    boxShadow: 'none',
    background: theme.palette.background.paper,
    zIndex: 1201,
    borderBottom: '1px solid ' + theme.palette.divider,
    transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
}));

type PasswordFormValues = {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
};

const Header = () => {
    const context = useDrawer();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { logo } = useAppSelector((state) => state.settings);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const { control, handleSubmit, reset, getValues } = useForm<PasswordFormValues>({
        defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
    });

    const { mutate, isPending } = useMutation({
        mutationFn: changePasswordRequest,
        onSuccess: () => {
            toast.success(t('passwordChangedSuccess'));
            setDialogOpen(false);
            reset();
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message;
            toast.error(typeof message === 'string' ? message : t('somethingWentWrong'));
        },
    });

    const handleClose = () => {
        setDialogOpen(false);
        reset();
    };

    const handleLogout = async () => {
        try {
            await logoutRequest();
        } catch {
            // proceed even if API fails
        }
        await removeTokenFromCookie();
        setAuthToken(null);
        dispatch(resetAuthData());
        router.replace(`/${i18n.language}/login`);
    };

    return (
        <>
            <AppBar position='fixed' open={context?.open}>
                <Toolbar>
                    <IconButton
                        color="primary"
                        aria-label="open drawer"
                        onClick={() => context?.dispatch({ type: "SET_OPEN", payload: !context?.open })}
                        edge="start"
                    >
                        <Menu />
                    </IconButton>
                    <CustomLink href="/admin">
                        <LogoWrapperDashboard>
                            <Image
                                src={getBackendUri(logo) ?? "/images/placeholder.png"}
                                alt="logo"
                                fill
                                style={{ objectFit: 'contain' }}
                                priority
                            />
                        </LogoWrapperDashboard>
                    </CustomLink>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" width="100%">
                        <Stack mx={2}>
                            <Link href="/" />
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            <LanguageIcon />
                            <Tooltip title={t('changePassword')}>
                                <IconButton
                                    color="primary"
                                    size="medium"
                                    onClick={() => setDialogOpen(true)}
                                >
                                    <LockOutlined fontSize="inherit" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('logout')}>
                                <IconButton
                                    color="primary"
                                    size="medium"
                                    onClick={handleLogout}
                                    aria-label="logout"
                                >
                                    <Logout fontSize="inherit" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Change Password Dialog */}
            <Dialog open={dialogOpen} onClose={handleClose} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>{t('changePassword')}</DialogTitle>
                <DialogContent>
                    <Stack
                        spacing={2.5}
                        component="form"
                        id="change-password-form"
                        onSubmit={handleSubmit((d) =>
                            mutate({ oldPassword: d.oldPassword, newPassword: d.newPassword })
                        )}
                        sx={{ pt: 1 }}
                    >
                        <TextInputComponent
                            name="oldPassword"
                            label={t('oldPassword')}
                            type={showOld ? 'text' : 'password'}
                            control={control}
                            rules={{ required: t('fieldIsRequired') }}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <IconButton size="small" onClick={() => setShowOld((v) => !v)}>
                                            {showOld ? <VisibilityOff fontSize="inherit" /> : <Visibility fontSize="inherit" />}
                                        </IconButton>
                                    ),
                                },
                            }}
                        />
                        <TextInputComponent
                            name="newPassword"
                            label={t('newPassword')}
                            type={showNew ? 'text' : 'password'}
                            control={control}
                            rules={{
                                required: t('fieldIsRequired'),
                                minLength: { value: 6, message: t('passwordMinLength') },
                            }}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <IconButton size="small" onClick={() => setShowNew((v) => !v)}>
                                            {showNew ? <VisibilityOff fontSize="inherit" /> : <Visibility fontSize="inherit" />}
                                        </IconButton>
                                    ),
                                },
                            }}
                        />
                        <TextInputComponent
                            name="confirmPassword"
                            label={t('confirmPassword')}
                            type={showConfirm ? 'text' : 'password'}
                            control={control}
                            rules={{
                                required: t('fieldIsRequired'),
                                validate: (v: any) => v === getValues('newPassword') || t('passwordsDoNotMatch'),
                            }}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <IconButton size="small" onClick={() => setShowConfirm((v) => !v)}>
                                            {showConfirm ? <VisibilityOff fontSize="inherit" /> : <Visibility fontSize="inherit" />}
                                        </IconButton>
                                    ),
                                },
                            }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={handleClose} disabled={isPending}>
                        {t('cancel')}
                    </Button>
                    <Button
                        type="submit"
                        form="change-password-form"
                        variant="contained"
                        loading={isPending}
                    >
                        {t('save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default Header;
