using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;
using System.Diagnostics;
using System.Threading;

class Program
{
    [DllImport("user32.dll")]
    public static extern uint GetClipboardSequenceNumber();

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    static bool IsRaycastForeground(out RECT rect)
    {
        rect = new RECT();
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return false;
        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        try
        {
            Process proc = Process.GetProcessById((int)pid);
            if (proc.ProcessName.IndexOf("raycast", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                GetWindowRect(hwnd, out rect);
                return true;
            }
        }
        catch {}
        return false;
    }

    static void RunClickWatcher()
    {
        bool wasDown = false;
        DateTime downTime = DateTime.MinValue;
        POINT downPt = new POINT();
        int checkCounter = 0;

        while (true)
        {
            Thread.Sleep(12);

            if (++checkCounter % 150 == 0)
            {
                try
                {
                    var rayProcs = Process.GetProcessesByName("Raycast");
                    if (rayProcs == null || rayProcs.Length == 0)
                    {
                        return;
                    }
                }
                catch {}
            }

            short state = GetAsyncKeyState(0x01); // VK_LBUTTON
            bool isDown = (state & 0x8000) != 0;

            if (isDown && !wasDown)
            {
                RECT rect;
                if (IsRaycastForeground(out rect))
                {
                    POINT pt;
                    if (GetCursorPos(out pt))
                    {
                        // Raycast grid area check (exclude top bar ~45px and bottom bar ~35px)
                        if (pt.X >= (rect.Left + 5) && pt.X <= (rect.Right - 5) &&
                            pt.Y >= (rect.Top + 45) && pt.Y <= (rect.Bottom - 35))
                        {
                            downTime = DateTime.UtcNow;
                            downPt = pt;
                            wasDown = true;
                            continue;
                        }
                    }
                }
                wasDown = false;
            }
            else if (!isDown && wasDown)
            {
                wasDown = false;
                double durationMs = (DateTime.UtcNow - downTime).TotalMilliseconds;
                if (durationMs >= 10 && durationMs <= 500)
                {
                    POINT upPt;
                    if (GetCursorPos(out upPt))
                    {
                        int dx = Math.Abs(upPt.X - downPt.X);
                        int dy = Math.Abs(upPt.Y - downPt.Y);
                        if (dx <= 15 && dy <= 15)
                        {
                            Console.WriteLine("CLICK");
                            Console.Out.Flush();
                        }
                    }
                }
            }
        }
    }

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            if (args.Length > 0 && (args[0] == "-watch-clicks" || args[0] == "--watch-clicks"))
            {
                RunClickWatcher();
                return 0;
            }

            // Operação de cópia direta para o Clipboard do Windows
            if (args.Length > 1 && (args[0] == "-copy" || args[0] == "--copy"))
            {
                string targetFile = args[1];
                if (!File.Exists(targetFile))
                {
                    Console.WriteLine("{{\"success\":false,\"error\":\"Arquivo não encontrado\"}}");
                    return 1;
                }

                using (Image img = Image.FromFile(targetFile))
                {
                    Clipboard.SetImage(img);
                }

                Console.WriteLine("{{\"success\":true,\"message\":\"Copiado com sucesso para a área de transferência\"}}");
                return 0;
            }

            string outDir = args.Length > 0 ? args[0] : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Fotoduo", "clipboard");
            if (!Directory.Exists(outDir))
            {
                Directory.CreateDirectory(outDir);
            }

            uint currentSeq = GetClipboardSequenceNumber();
            string seqFile = Path.Combine(outDir, "last_seq.txt");
            uint lastSeq = 0;
            if (File.Exists(seqFile))
            {
                uint.TryParse(File.ReadAllText(seqFile).Trim(), out lastSeq);
            }
            bool isNewSeq = (currentSeq != lastSeq);

            // 1. Direct Image in Clipboard
            if (Clipboard.ContainsImage())
            {
                using (Image img = Clipboard.GetImage())
                {
                    if (img != null)
                    {
                        byte[] bytes;
                        using (var ms = new MemoryStream())
                        {
                            img.Save(ms, ImageFormat.Png);
                            bytes = ms.ToArray();
                        }

                        string hash;
                        using (var md5 = MD5.Create())
                        {
                            hash = BitConverter.ToString(md5.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
                        }

                        string fileName = "clip-" + hash + ".png";
                        string fullPath = Path.Combine(outDir, fileName);

                        bool fileExisted = File.Exists(fullPath) && new FileInfo(fullPath).Length > 0;
                        if (!fileExisted)
                        {
                            File.WriteAllBytes(fullPath, bytes);
                            File.SetLastWriteTime(fullPath, DateTime.Now);
                        }
                        else if (isNewSeq)
                        {
                            File.SetLastWriteTime(fullPath, DateTime.Now);
                        }

                        if (isNewSeq)
                        {
                            File.WriteAllText(seqFile, currentSeq.ToString());
                        }

                        var fi = new FileInfo(fullPath);
                        long mtimeMs = (long)(fi.LastWriteTimeUtc.Subtract(new DateTime(1970, 1, 1))).TotalMilliseconds;

                        Console.WriteLine("{{\"success\":true,\"type\":\"clipboard_image\",\"path\":\"{0}\",\"width\":{1},\"height\":{2},\"hash\":\"{3}\",\"size\":{4},\"sequence\":{5},\"isNew\":{6},\"mtime\":{7}}}",
                            fullPath.Replace("\\", "\\\\"), img.Width, img.Height, hash, bytes.Length, currentSeq, isNewSeq ? "true" : "false", mtimeMs);
                        return 0;
                    }
                }
            }

            // 2. Copied File(s) in Clipboard
            if (Clipboard.ContainsFileDropList())
            {
                var files = Clipboard.GetFileDropList();
                foreach (string f in files)
                {
                    if (File.Exists(f))
                    {
                        string ext = Path.GetExtension(f).ToLowerInvariant();
                        if (ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".webp" || ext == ".bmp")
                        {
                            var fi = new FileInfo(f);
                            if (isNewSeq)
                            {
                                File.WriteAllText(seqFile, currentSeq.ToString());
                            }
                            long mtimeMs = (long)(fi.LastWriteTimeUtc.Subtract(new DateTime(1970, 1, 1))).TotalMilliseconds;
                            Console.WriteLine("{{\"success\":true,\"type\":\"copied_file\",\"path\":\"{0}\",\"size\":{1},\"sequence\":{2},\"isNew\":{3},\"mtime\":{4}}}",
                                f.Replace("\\", "\\\\"), fi.Length, currentSeq, isNewSeq ? "true" : "false", mtimeMs);
                            return 0;
                        }
                    }
                }
            }

            if (isNewSeq)
            {
                File.WriteAllText(seqFile, currentSeq.ToString());
            }

            Console.WriteLine("{{\"success\":false,\"reason\":\"no_image\",\"sequence\":{0}}}", currentSeq);
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine("{{\"success\":false,\"error\":\"{0}\"}}", ex.Message.Replace("\\", "\\\\").Replace("\"", "\\\""));
            return 1;
        }
    }
}
