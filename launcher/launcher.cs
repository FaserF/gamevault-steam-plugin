using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("GameVault Steam Launcher")]
[assembly: AssemblyProduct("GameVault")]
[assembly: AssemblyCompany("GameVault")]
[assembly: AssemblyCopyright("Copyright © 2026")]
[assembly: AssemblyFileVersion("2.0.5.0")]
[assembly: AssemblyVersion("2.0.5.0")]

namespace GameVaultSteamLauncher
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string appId = "";
            try
            {
                if (File.Exists("steam_appid.txt"))
                {
                    appId = File.ReadAllText("steam_appid.txt").Trim();
                }
                else if (File.Exists("launch.url"))
                {
                    foreach (var line in File.ReadAllLines("launch.url"))
                    {
                        if (line.Contains("steam://run/"))
                        {
                            int idx = line.IndexOf("steam://run/");
                            appId = line.Substring(idx + 12).Trim();
                            break;
                        }
                    }
                }

                if (!string.IsNullOrEmpty(appId))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "steam://run/" + appId,
                        UseShellExecute = true
                    });
                }
                else
                {
                    MessageBox.Show("Could not find Steam App ID from steam_appid.txt or launch.url.",
                        "GameVault Steam Launcher", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error launching Steam game: " + ex.Message,
                    "GameVault Steam Launcher", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
