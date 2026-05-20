"use client"
import { useAppSelector } from '@/Store/store'
import Image from 'next/image'
import { memo } from 'react'

const SiteLogo = () => {
    const { logo } = useAppSelector((state) => state.tenant)

    return (
        <Image
            src={logo || "/logo.webp"}
            alt='logo'
            width={40}
            height={40}
            priority
        />
    )
}

export default memo(SiteLogo)
