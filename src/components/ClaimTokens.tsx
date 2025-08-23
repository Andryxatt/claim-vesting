import React, { useState } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { debounce } from "lodash";
import { useCallback } from "react";
import {
    PublicKey,
    SystemProgram,
} from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import idlTokenVesting from "../assets/token_vesting.json";
import { Buffer } from "buffer";

if (!window.Buffer) {
    window.Buffer = Buffer;
}
const MINT = new PublicKey(import.meta.env.VITE_TOKEN_MINT);

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);



const ClaimToken: React.FC = () => {
    const [companyName, setCompanyName] = useState('refferAI')
    const [isAveliableClaim, setIsAveliableClaim] = useState(false)
    const { address } = useAppKitAccount();
    const { connection } = useAppKitConnection();
    const { walletProvider } = useAppKitProvider<Wallet>("solana");
    const onChangeSearch = useCallback(
        debounce(async (value: string) => {
            if (!walletProvider || !connection || !address) {
                console.error("❌ Wallet not connected");
                return;
            }
            console.log(value)
            const provider = new AnchorProvider(connection!, walletProvider, {
                preflightCommitment: "processed",
            });

            const program = new Program(idlTokenVesting as Idl, provider);
            // 1. Витягуємо всі вестинг акаунти
            const vestings = await (program.account as any).vestingAccount.all();
            // 2. Перевіряємо чи value схоже на адресу (base58)
            let myVesting: any;
            try {
                const pubkey = new PublicKey(value); // якщо помилка → значить це не адреса
                myVesting = vestings.find((v: any) => v.publicKey.equals(pubkey));
            } catch (e) {
                // 3. Якщо не адреса → шукаємо по companyName (seed)
                myVesting = vestings.find((v: any) => v.account.companyName === value);
            }

            if (!myVesting) {
                setIsAveliableClaim(true);
                return;
            }

            setCompanyName(myVesting.account.companyName);
            setIsAveliableClaim(false);
        }, 2000), // 2 секунди після зупинки вводу
        [walletProvider, connection, address]
    );
    const claimTokens = async () => {
        try {
            if (!walletProvider || !connection || !address) {
                console.error("❌ Wallet not connected"); 
                return;
            }

            const provider = new AnchorProvider(connection!, walletProvider, {
                preflightCommitment: "processed",
            });

            const program = new Program(idlTokenVesting as Idl, provider);

            const beneficiary = new PublicKey(address);
           

            const [vestingAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from(companyName)],
                program.programId
            );
            const [employeeAccountPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("employee_vesting"),
                    beneficiary.toBuffer(),
                    vestingAccount.toBuffer(),
                ],
                PROGRAM_ID
            );
            const [treasuryTokenAccountPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
                PROGRAM_ID
            );


            const ata = await getAssociatedTokenAddress(
                MINT,
                beneficiary,
                false,
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            console.log("🔑 VestingAccount:", vestingAccount.toBase58());
            console.log("🔑 EmployeeAccount:", employeeAccountPda.toBase58());
            console.log("🔑 TreasuryTokenAccount:", treasuryTokenAccountPda.toBase58());

            const sig = await program.methods
                .claimTokens(companyName) // передаємо з акаунта, а не хардкод
                .accounts({
                    beneficiary,
                    employeeAccount: employeeAccountPda,
                    vestingAccount,
                    MINT,
                    treasuryTokenAccountPda,
                    employeeTokenAccount: ata,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("✅ Claim success:", sig);
            alert(`✅ Claim success! Tx: https://explorer.solana.com/tx/${sig}?cluster=${import.meta.env.VITE_CLUSTER}`);
        } catch (err: any) {
            console.error("❌ Claim error:", err);
            alert(`❌ Claim failed: ${err.message}`);
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Claim Tokens</h2>
            <div>
                <label>Search by seeds or address</label>
                <input placeholder="seeds or address" className="border p-2 rounded-md p-4" type="text" onChange={(e) => onChangeSearch(e.target.value)} />
            </div>
            <button
                disabled={isAveliableClaim}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={claimTokens}
            >
                Claim
            </button>
        </div>
    );
};

export default ClaimToken;
