import React, { useState, useCallback, useEffect } from "react";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { debounce } from "lodash";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { AnchorProvider, Idl, Program, Wallet, BN } from "@coral-xyz/anchor";
import idlTokenVesting from "../assets/token_vesting.json";
import { Buffer } from "buffer";
import CustomButton from "./CustomButton";
import { showError } from "./notifications/Error";
import { showSuccess } from "./notifications/Success";

if (!window.Buffer) {
  window.Buffer = Buffer;
}

const MINT = new PublicKey(import.meta.env.VITE_TOKEN_MINT);
const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID);

const ClaimToken: React.FC = () => {
  const [companyName, setCompanyName] = useState("refferAI");
  const [isAvailableClaim, setIsAvailableClaim] = useState(false);
  const [claimable, setClaimable] = useState<number>(0);
  const [claimed, setClaimed] = useState<number>(0);
  const [decimals, setDecimals] = useState<number>(9);
  const [symbol, setSymbol] = useState<string>("TOKEN"); // якщо немає метаданих

  const { address } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const { walletProvider } = useAppKitProvider<Wallet>("solana");

  // Тягнемо mint info
  useEffect(() => {
    const fetchMintInfo = async () => {
      if (!connection) return;
      try {
        const mintInfo = await getMint(connection, MINT);
        setDecimals(mintInfo.decimals);
        console.log("🪙 Mint info:", mintInfo);
        // символ залишаємо "TOKEN" якщо немає метаданих
        setSymbol("TOKEN");
      } catch (err) {
        console.error("❌ Не вдалося витягнути mint info:", err);
      }
    };
    fetchMintInfo();
  }, [connection]);

  // Пошук по seeds (companyName)
  const onChangeSearch = useCallback(
    debounce(async (value: string) => {
      if (!walletProvider || !connection || !address) return;

      const provider = new AnchorProvider(connection!, walletProvider, {
        preflightCommitment: "processed",
      });
      const program = new Program(idlTokenVesting as Idl, provider);

      const vestings = await (program.account as any).vestingAccount.all();
      const myVesting = vestings.find((v: any) => v.account.companyName === value);

      if (!myVesting) {
        setIsAvailableClaim(true);
        setClaimable(0);
        setClaimed(0);
        showError("No vesting account found for this companyName");
        return;
      }
      else {
        setCompanyName(myVesting.account.companyName);
        setIsAvailableClaim(false);
      }



      try {
        const beneficiary = new PublicKey(address);
        const [employeeAccountPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("employee_vesting"),
            beneficiary.toBuffer(),
            myVesting.publicKey.toBuffer(),
          ],
          PROGRAM_ID
        );

        const employeeAcc = await (program.account as any).employeeAccount.fetch(
          employeeAccountPda
        );

        const totalAmount = (employeeAcc.totalAmount as BN).toNumber();
        const totalWithdrawn = (employeeAcc.totalWithdrawn as BN).toNumber();
        const available = totalAmount - totalWithdrawn;

        setClaimed(totalWithdrawn);
        setClaimable(available);
      } catch (err) {
        console.error("❌ Не вдалося витягнути employeeAccount:", err);
        setClaimed(0);
        setClaimable(0);
      }
    }, 1000),
    [walletProvider, connection, address]
  );

  // Claim функція
  const claimTokens = async () => {
    try {
      if (!walletProvider || !connection || !address) return;

      const provider = new AnchorProvider(connection!, walletProvider, {
        preflightCommitment: "processed",
      });
      const program = new Program(idlTokenVesting as Idl, provider);

      const beneficiary = new PublicKey(address);
      const vestings = await (program.account as any).vestingAccount.all();
      const myVesting = vestings.find((v: any) => v.account.companyName === companyName);

      if (!myVesting) throw new Error("Вестинг для цього користувача не знайдено");

      const vestingAccount = myVesting.publicKey;
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
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const sig = await program.methods
        .claimTokens(companyName)
        .accounts({
          beneficiary,
          employeeAccount: employeeAccountPda,
          vestingAccount,
          MINT,
          treasuryTokenAccountPda,
          employeeTokenAccount: ata,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      showSuccess(sig);
    } catch (err: any) {
      console.error("❌ Claim error:", err);
      showError(err.message || "Transaction failed");
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-md shadow-md max-w-md w-full flex flex-col">
      <h2 className="text-xl font-semibold">Claim Tokens</h2>
      <div className="flex gap-1 flex-col">
        <label>Company Name</label>
        <input className="border p-2 rounded-md" type="text" placeholder="Enter companyName seed" onChange={(e) => onChangeSearch(e.target.value)} />
      </div>

      <div className="p-2 bg-gray-100 rounded-md">
        Available for claim: <b>{claimable / 10 ** decimals}</b> {symbol}
      </div>
      <div className="p-2 bg-gray-100 rounded-md">
        Already claimed: <b>{claimed / 10 ** decimals}</b> {symbol}
      </div>
      <CustomButton
        restClasses="w-full self-right"
        disabled={isAvailableClaim || claimable <= 0}
        text="Claim"
        onClick={claimTokens}
        tooltipText={isAvailableClaim ? "No vesting account found for this companyName" : claimable <= 0 ? "No tokens available to claim" : undefined}
      />
    </div>
  );
};

export default ClaimToken;
