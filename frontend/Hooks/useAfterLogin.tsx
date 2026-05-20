import { changeAuthData } from "@/Store/slices/auth"
import { useAppDispatch } from "@/Store/store"
import { useRouter } from "next/navigation"

export interface DataTypes {
    token: string,
    user: {
        isSuper: boolean
        email: string
        name: string
        id: number
        cartCount: number
        // permissions: any[]
    }
}

const useAfterLogin = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const callFunction = (data: DataTypes) => {
        localStorage.setItem("token", data.token!)
        // const isAdmin = data.user.isAdmin
        // const isSuper = data.user.isSuper

        dispatch(changeAuthData({
            isLoggedIn: true,
            role: "admin",
            user: {
                email: "",
                id: "",
                name: ""
            }

        }))

        router.push("/admin");
    }
    return { callFunction }
}

export default useAfterLogin