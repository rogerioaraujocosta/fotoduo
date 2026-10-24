using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

[ComImport, Guid("6D5140C1-7436-11CE-8034-00AA006009FA"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IServiceProviderNative
{
    [PreserveSig] int QueryService(ref Guid sid, ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object obj);
}

[ComImport, Guid("000214E2-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellBrowserNative
{
    [PreserveSig] int GetWindow(out IntPtr hwnd); // 1º método (IOleWindow) – basta para a vtable
}

class Candidate { public long Hwnd; public IntPtr Tab; public string Path; public string Name; public bool IsFs; }

class Program
{
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder sb, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p, IntPtr after, string cls, string title);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int val, int size);

    static object Prop(object o, string n) { return o.GetType().InvokeMember(n, BindingFlags.GetProperty, null, o, null); }
    static object Call(object o, string n, params object[] a) { return o.GetType().InvokeMember(n, BindingFlags.InvokeMethod, null, o, a); }

    static string Esc(string s)
    {
        if (s == null) return "";
        var sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == '\\') sb.Append("\\\\");
            else if (c == '"') sb.Append("\\\"");
            else if (c < 0x20 || c > 0x7E) sb.Append("\\u" + ((int)c).ToString("x4"));
            else sb.Append(c);
        }
        return sb.ToString();
    }

    static List<IntPtr> CabinetsInZOrder()
    {
        var list = new List<IntPtr>();
        EnumWindows(delegate (IntPtr h, IntPtr l)
        {
            var sb = new StringBuilder(64);
            GetClassName(h, sb, 64);
            if (sb.ToString() == "CabinetWClass" && IsWindowVisible(h))
            {
                int cloaked = 0;
                try { DwmGetWindowAttribute(h, 14, out cloaked, 4); } catch { }
                if (cloaked == 0) list.Add(h);
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    static List<Candidate> ListExplorerFolders()
    {
        var result = new List<Candidate>();
        Guid sid = new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837"); // SID_STopLevelBrowser
        Guid iid = new Guid("000214E2-0000-0000-C000-000000000046"); // IID_IShellBrowser
        object shell = Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application"));
        object windows = Call(shell, "Windows");
        int count = (int)Prop(windows, "Count");
        for (int i = 0; i < count; i++)
        {
            try
            {
                object w = Call(windows, "Item", i);
                if (w == null) continue;
                string full = Convert.ToString(Prop(w, "FullName")) ?? "";
                if (!full.EndsWith("explorer.exe", StringComparison.OrdinalIgnoreCase)) continue;
                object self = Prop(Prop(Prop(w, "Document"), "Folder"), "Self");
                var c = new Candidate();
                c.Hwnd = Convert.ToInt64(Prop(w, "HWND"));
                c.Path = Convert.ToString(Prop(self, "Path"));
                c.Name = Convert.ToString(Prop(self, "Name"));
                bool isFs = false;
                try { isFs = (bool)Prop(self, "IsFileSystem"); } catch { }
                c.IsFs = isFs && !string.IsNullOrEmpty(c.Path) && !c.Path.StartsWith("::") && Directory.Exists(c.Path);
                try
                {
                    object sbObj;
                    if (((IServiceProviderNative)w).QueryService(ref sid, ref iid, out sbObj) == 0 && sbObj != null)
                        ((IShellBrowserNative)sbObj).GetWindow(out c.Tab);
                }
                catch { }
                result.Add(c);
            }
            catch { }
        }
        return result;
    }

    static string CandJson(Candidate c)
    {
        return string.Format("{{\"path\":\"{0}\",\"name\":\"{1}\",\"isFileSystem\":{2}}}",
            Esc(c.Path), Esc(c.Name), c.IsFs ? "true" : "false");
    }

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            List<Candidate> cands = ListExplorerFolders();
            List<IntPtr> z = CabinetsInZOrder();
            Candidate chosen = null;
            string method = "none";

            foreach (IntPtr top in z)
            {
                long topL = top.ToInt64();
                List<Candidate> inWin = cands.FindAll(delegate (Candidate c) { return c.Hwnd == topL; });
                if (inWin.Count == 0) continue;
                if (inWin.Count == 1) { chosen = inWin[0]; method = "zorder"; break; }
                IntPtr activeTab = FindWindowEx(top, IntPtr.Zero, "ShellTabWindowClass", null);
                chosen = inWin.Find(delegate (Candidate c) { return c.Tab != IntPtr.Zero && c.Tab == activeTab; });
                if (chosen != null) method = "zorder-tab";
                else { chosen = inWin[0]; method = "zorder-firsttab"; }
                break;
            }
            if (chosen == null && cands.Count == 1) { chosen = cands[0]; method = "single"; }

            var parts = new List<string>();
            foreach (Candidate c in cands) parts.Add(CandJson(c));
            Console.WriteLine("{{\"success\":true,\"method\":\"{0}\",\"zorderCount\":{1},\"folder\":{2},\"candidates\":[{3}]}}",
                method, z.Count, chosen == null ? "null" : CandJson(chosen), string.Join(",", parts.ToArray()));
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine("{{\"success\":false,\"error\":\"{0}\"}}", Esc(ex.Message));
            return 1;
        }
    }
}
